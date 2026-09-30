// 渲染进程：UI 事件绑定 + 视图切换 + 音效触发
// 依赖：window.timerAPI（preload 暴露）、AudioPlayer（audio.js）、HiitTimer（timer.js）

const FIELDS = [
  { key: 'warmup',     step: 5, min: 0, max: 600 },
  { key: 'work',       step: 5, min: 1, max: 600 },
  { key: 'rest',       step: 5, min: 0, max: 600 },
  { key: 'betweenSets',step: 5, min: 0, max: 600 },
  { key: 'stretch',    step: 5, min: 0, max: 600 },
  { key: 'sets',       step: 1, min: 1, max: 50 },
  { key: 'repsPerSet', step: 1, min: 1, max: 100 }
];

const STATE_LABELS_CN = {
  idle: '准备', warmup: '热身', work: '锻炼', rest: '休息',
  between_sets: '组间间隔', stretch: '拉伸', done: '完成'
};

const STATE_LABELS_EN = {
  idle: 'READY', warmup: 'WARM UP', work: 'WORK', rest: 'REST',
  between_sets: 'BREAK', stretch: 'STRETCH', done: 'DONE'
};

const ALL_STATES = ['idle', 'warmup', 'work', 'rest', 'between_sets', 'stretch', 'done'];

const RING_CIRCUMFERENCE = 2 * Math.PI * 128; // r=128，匹配 v2 环形尺寸

const audio = new AudioPlayer();
const timer = new HiitTimer();

let config = {};

const $ = (id) => document.getElementById(id);

const els = {
  viewConfig: $('view-config'),
  viewTrain: $('view-train'),
  form: $('config-form'),
  stageLabel: $('stage-label'),
  countdown: $('countdown'),
  countdownLabel: $('countdown-label'),
  setProgress: $('set-progress'),
  repsProgress: $('reps-progress'),
  ringFg: document.querySelector('.ring-fg-circle'),
  btnPause: $('btn-pause'),
  btnStop: $('btn-stop'),
  saveHint: $('save-hint')
};

// === 配置读写（UI ↔ 内存） ===
function readConfigFromUI() {
  const cfg = {};
  FIELDS.forEach(f => {
    cfg[f.key] = parseInt($(`val-${f.key}`).textContent, 10);
  });
  return cfg;
}

function fillUI(cfg) {
  FIELDS.forEach(f => {
    $(`val-${f.key}`).textContent = cfg[f.key];
  });
  config = { ...cfg };
}

// 步进按钮处理
function handleStep(field, delta) {
  const def = FIELDS.find(f => f.key === field);
  if (!def) return;
  let v = parseInt($(`val-${field}`).textContent, 10) + delta;
  v = Math.max(def.min, Math.min(def.max, v));
  $(`val-${field}`).textContent = v;
  config[field] = v;
  scheduleSave();
}

// 自动保存（debounce 600ms）
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await Storage.save(config);
      showHint('配置已保存');
    } catch (e) {
      console.error('保存失败', e);
    }
  }, 600);
}

function showHint(text) {
  els.saveHint.textContent = text;
  setTimeout(() => { els.saveHint.textContent = ''; }, 1500);
}

// === 格式化：倒计时显示秒数（<10 补零），匹配超大字布局 ===
function formatCountdown(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return s < 10 ? '0' + s : String(s);
}

// === 音效 ===
function playSoundForState(state) {
  switch (state) {
    case 'warmup':       audio.playWarmupStart(); break;
    case 'work':         audio.playWorkStart(); break;
    case 'rest':         audio.playRestStart(); break;
    case 'between_sets': audio.playBetweenSetsStart(); break;
    case 'stretch':      audio.playStretchStart(); break;
    case 'done':         audio.playDone(); break;
  }
}

// === 视图更新 ===
function setTrainState(state) {
  ALL_STATES.forEach(s => els.viewTrain.classList.remove('state-' + s));
  els.viewTrain.classList.add('state-' + state);
}

function updateRing(state, remaining, total) {
  const ratio = total > 0 ? remaining / total : 0;
  els.ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - ratio);
}

function updateSetProgress(snap) {
  if (!timer.config) { els.setProgress.textContent = ''; return; }
  switch (snap.state) {
    case 'warmup':
      els.setProgress.textContent = '准备开始';
      break;
    case 'work':
    case 'rest':
      els.setProgress.textContent = `组 ${snap.setIndex} / ${timer.config.sets} · 次 ${snap.repIndex} / ${timer.config.repsPerSet}`;
      break;
    case 'between_sets':
      els.setProgress.textContent = `下一组 · 组 ${snap.setIndex + 1} / ${timer.config.sets}`;
      break;
    case 'stretch':
      els.setProgress.textContent = '最后阶段';
      break;
    case 'done':
      els.setProgress.textContent = '训练结束 · 干得漂亮';
      break;
    default:
      els.setProgress.textContent = '';
  }
}

function updateRepsProgress(snap) {
  if (!timer.config || !['work', 'rest', 'between_sets'].includes(snap.state)) {
    els.repsProgress.innerHTML = '';
    return;
  }
  const total = timer.config.repsPerSet;
  const current = snap.repIndex;
  let html = '';
  for (let i = 1; i <= total; i++) {
    let cls = 'rep-dot';
    if (i < current) cls += ' done';
    else if (i === current && snap.state === 'work') cls += ' active';
    html += `<span class="${cls}"></span>`;
  }
  els.repsProgress.innerHTML = html;
}

function resetTrainButtons() {
  els.btnPause.style.display = '';
  els.btnPause.textContent = '暂停';
  els.btnPause.disabled = false;
  els.btnStop.textContent = '停止';
  els.btnStop.classList.add('danger');
}

function showConfigView() {
  els.viewConfig.classList.remove('hidden');
  els.viewTrain.classList.add('hidden');
}

function showTrainView() {
  els.viewConfig.classList.add('hidden');
  els.viewTrain.classList.remove('hidden');
}

// === 订阅计时器事件 ===
timer.onTick((snap) => {
  els.countdown.textContent = formatCountdown(snap.remainingSec);
  updateRing(snap.state, snap.remainingSec, snap.totalSec);
  els.btnPause.textContent = snap.paused ? '继续' : '暂停';
});

timer.onStateChange((snap) => {
  setTrainState(snap.state);
  els.stageLabel.textContent = STATE_LABELS_CN[snap.state] || '';
  els.countdownLabel.textContent = STATE_LABELS_EN[snap.state] || '';

  if (snap.state === 'done') {
    els.countdown.textContent = '✓';
    els.countdown.classList.add('done-mark');
    els.btnPause.style.display = 'none';
    els.btnStop.textContent = '返回配置';
    els.btnStop.classList.remove('danger');
  } else {
    els.countdown.textContent = formatCountdown(snap.remainingSec);
    els.countdown.classList.remove('done-mark');
    els.btnPause.style.display = '';
    els.btnPause.textContent = '暂停';
    els.btnPause.disabled = false;
    els.btnStop.textContent = '停止';
    els.btnStop.classList.add('danger');
  }

  updateRing(snap.state, snap.remainingSec, snap.totalSec);
  updateSetProgress(snap);
  updateRepsProgress(snap);
  playSoundForState(snap.state);
});

// === 事件绑定 ===
// 步进按钮
document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.field-row');
    const field = row.dataset.field;
    const delta = parseInt(btn.dataset.delta, 10);
    handleStep(field, delta);
  });
});

// 开始训练
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cfg = readConfigFromUI();
  if (cfg.sets < 1 || cfg.repsPerSet < 1 || cfg.work < 1) {
    showHint('组数、次数、锻炼时间必须大于 0');
    return;
  }
  // 必须在用户交互的同步上下文中初始化 AudioContext
  await audio.ensureCtx();
  await Storage.save(cfg);
  config = { ...cfg };
  resetTrainButtons();
  showTrainView();
  timer.start(cfg);
});

// 暂停/继续
els.btnPause.addEventListener('click', () => {
  if (timer.state === 'idle' || timer.state === 'done') return;
  if (timer.paused) timer.resume();
  else timer.pause();
});

// 停止 / 返回配置
els.btnStop.addEventListener('click', () => {
  timer.stop();
  resetTrainButtons();
  showConfigView();
});

// === 窗口控制（自定义标题栏，仅 Electron 环境） ===
if (window.windowAPI) {
  $('win-minimize').addEventListener('click', () => window.windowAPI.minimize());
  $('win-maximize').addEventListener('click', () => window.windowAPI.maximizeToggle());
  $('win-close').addEventListener('click', () => window.windowAPI.close());
  // 最大化状态变化 → 切换最大化/还原图标
  const icoMax = document.querySelector('.ico-max');
  const icoRestore = document.querySelector('.ico-restore');
  const syncMaxIcon = (isMax) => {
    if (icoMax) icoMax.style.display = isMax ? 'none' : 'block';
    if (icoRestore) icoRestore.style.display = isMax ? 'block' : 'none';
  };
  window.windowAPI.onMaximizeChange(syncMaxIcon);
  window.windowAPI.isMaximized().then(syncMaxIcon);
} else {
  // 非 Electron（移动端/浏览器）：隐藏桌面窗口标题栏
  document.querySelector('.titlebar')?.classList.add('hidden-titlebar');
}

// === 初始化：加载本地配置并填充 UI ===
(async () => {
  try {
    const cfg = await Storage.load();
    fillUI(cfg);
  } catch (e) {
    console.error('加载配置失败', e);
  }
})();

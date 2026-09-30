// 渲染进程：UI 事件绑定 + 视图切换 + 音效触发
// 依赖：window.timerAPI（preload 暴露）、AudioPlayer（audio.ts）、HiitTimer（timer.ts）、ConfigStore（storage.ts）

const FIELDS: ReadonlyArray<{ key: keyof TimerConfig; step: number; min: number; max: number }> = [
  { key: 'warmup',      step: 5, min: 0, max: 600 },
  { key: 'work',        step: 5, min: 1, max: 600 },
  { key: 'rest',        step: 5, min: 0, max: 600 },
  { key: 'betweenSets', step: 5, min: 0, max: 600 },
  { key: 'stretch',     step: 5, min: 0, max: 600 },
  { key: 'sets',        step: 1, min: 1, max: 50 },
  { key: 'repsPerSet',  step: 1, min: 1, max: 100 }
];

const STATE_LABELS_CN: Record<TimerState, string> = {
  idle: '准备', warmup: '热身', work: '锻炼', rest: '休息',
  between_sets: '组间间隔', stretch: '拉伸', done: '完成'
};

const STATE_LABELS_EN: Record<TimerState, string> = {
  idle: 'READY', warmup: 'WARM UP', work: 'WORK', rest: 'REST',
  between_sets: 'BREAK', stretch: 'STRETCH', done: 'DONE'
};

const ALL_STATES: readonly TimerState[] = ['idle', 'warmup', 'work', 'rest', 'between_sets', 'stretch', 'done'];

const RING_CIRCUMFERENCE = 2 * Math.PI * 128; // r=128，匹配 v2 环形尺寸

const audio = new AudioPlayer();
const timer = new HiitTimer();

// 读取必需的 DOM 元素。缺失即说明 index.html 与脚本不同步，直接抛错而不是静默跳过。
function mustGet<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少必需的 DOM 元素: #${id}`);
  return el as T;
}

function mustQuery<T extends Element = Element>(selector: string): T {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`缺少必需的 DOM 元素: ${selector}`);
  return el as T;
}

const els = {
  viewConfig: mustGet('view-config'),
  viewTrain: mustGet('view-train'),
  form: mustGet<HTMLFormElement>('config-form'),
  stageLabel: mustGet('stage-label'),
  countdown: mustGet('countdown'),
  countdownLabel: mustGet('countdown-label'),
  setProgress: mustGet('set-progress'),
  repsProgress: mustGet('reps-progress'),
  ringFg: mustQuery<SVGCircleElement>('.ring-fg-circle'),
  btnPause: mustGet<HTMLButtonElement>('btn-pause'),
  btnStop: mustGet<HTMLButtonElement>('btn-stop'),
  saveHint: mustGet('save-hint')
};

// 当前配置的唯一内存副本；初值取 index.html 的初始值（与主进程 DEFAULT_CONFIG 一致）
let config: TimerConfig = readConfigFromUI();

// === 配置读写（UI ↔ 内存） ===
function readConfigFromUI(): TimerConfig {
  const cfg = {} as TimerConfig;
  FIELDS.forEach(f => {
    cfg[f.key] = parseInt(mustGet(`val-${f.key}`).textContent ?? '', 10);
  });
  return cfg;
}

function fillUI(cfg: TimerConfig): void {
  FIELDS.forEach(f => {
    mustGet(`val-${f.key}`).textContent = String(cfg[f.key]);
  });
  config = { ...cfg };
}

// 步进按钮处理
function handleStep(field: string, delta: number): void {
  const def = FIELDS.find(f => f.key === field);
  if (!def) return;
  let v = parseInt(mustGet(`val-${field}`).textContent ?? '', 10) + delta;
  v = Math.max(def.min, Math.min(def.max, v));
  mustGet(`val-${field}`).textContent = String(v);
  config[def.key] = v;
  scheduleSave();
}

// 自动保存（debounce 600ms）
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await ConfigStore.save(config);
      showHint('配置已保存');
    } catch (e) {
      console.error('保存失败', e);
    }
  }, 600);
}

function showHint(text: string): void {
  els.saveHint.textContent = text;
  setTimeout(() => { els.saveHint.textContent = ''; }, 1500);
}

// === 格式化：倒计时显示秒数（<10 补零），匹配超大字布局 ===
function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return s < 10 ? '0' + s : String(s);
}

// === 音效 ===
function playSoundForState(state: TimerState): void {
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
function setTrainState(state: TimerState): void {
  ALL_STATES.forEach(s => els.viewTrain.classList.remove('state-' + s));
  els.viewTrain.classList.add('state-' + state);
}

function updateRing(state: TimerState, remaining: number, total: number): void {
  const ratio = total > 0 ? remaining / total : 0;
  els.ringFg.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
}

function updateSetProgress(snap: TimerSnapshot): void {
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

function updateRepsProgress(snap: TimerSnapshot): void {
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

function resetTrainButtons(): void {
  els.btnPause.style.display = '';
  els.btnPause.textContent = '暂停';
  els.btnPause.disabled = false;
  els.btnStop.textContent = '停止';
  els.btnStop.classList.add('danger');
}

function showConfigView(): void {
  els.viewConfig.classList.remove('hidden');
  els.viewTrain.classList.add('hidden');
}

function showTrainView(): void {
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
document.querySelectorAll<HTMLButtonElement>('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = btn.closest<HTMLElement>('.field-row');
    const field = row?.dataset.field;
    const delta = parseInt(btn.dataset.delta ?? '', 10);
    if (!field || !Number.isFinite(delta)) return;
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
  await ConfigStore.save(cfg);
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
const winAPI = windowAPI;
if (winAPI) {
  mustGet('win-minimize').addEventListener('click', () => { void winAPI.minimize(); });
  mustGet('win-maximize').addEventListener('click', () => { void winAPI.maximizeToggle(); });
  mustGet('win-close').addEventListener('click', () => { void winAPI.close(); });
  // 最大化状态变化 → 切换最大化/还原图标
  const icoMax = document.querySelector<HTMLElement>('.ico-max');
  const icoRestore = document.querySelector<HTMLElement>('.ico-restore');
  const syncMaxIcon = (isMax: boolean): void => {
    if (icoMax) icoMax.style.display = isMax ? 'none' : 'block';
    if (icoRestore) icoRestore.style.display = isMax ? 'block' : 'none';
  };
  winAPI.onMaximizeChange(syncMaxIcon);
  void winAPI.isMaximized().then(syncMaxIcon);
} else {
  // 非 Electron（移动端/浏览器）：隐藏桌面窗口标题栏
  document.querySelector('.titlebar')?.classList.add('hidden-titlebar');
}

// === 初始化：加载本地配置并填充 UI ===
(async () => {
  try {
    const cfg = await ConfigStore.load();
    if (cfg) fillUI(cfg);
  } catch (e) {
    console.error('加载配置失败', e);
  }
})();

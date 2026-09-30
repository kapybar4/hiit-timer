// HiitTimer: HIIT 计时器状态机
// 纯逻辑、无 DOM 依赖，通过 onTick/onStateChange 订阅事件
//
// 流程: IDLE -> WARMUP -> [WORK -> REST (×repsPerSet) -> BETWEEN_SETS] × sets -> STRETCH -> DONE
// 最后一组结束后跳过 BETWEEN_SETS 直接进入 STRETCH

const STATES = {
  IDLE: 'idle',
  WARMUP: 'warmup',
  WORK: 'work',
  REST: 'rest',
  BETWEEN_SETS: 'between_sets',
  STRETCH: 'stretch',
  DONE: 'done'
} as const;

const STATE_LABELS: Record<TimerState, string> = {
  idle: '准备',
  warmup: '热身',
  work: '锻炼',
  rest: '休息',
  between_sets: '组间间隔',
  stretch: '拉伸',
  done: '完成'
};

class HiitTimer {
  state: TimerState = STATES.IDLE;
  config: TimerConfig | null = null;
  setIndex = 0;   // 当前组（1-based）
  repIndex = 0;   // 当前组内次数（1-based）
  remainingSec = 0;
  totalSec = 0;
  paused = false;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickCallbacks: Array<(snap: TimerSnapshot) => void> = [];
  private stateCallbacks: Array<(snap: TimerSnapshot, prevState: TimerState) => void> = [];

  onTick(cb: (snap: TimerSnapshot) => void): void { this.tickCallbacks.push(cb); }
  onStateChange(cb: (snap: TimerSnapshot, prevState: TimerState) => void): void { this.stateCallbacks.push(cb); }

  snapshot(): TimerSnapshot {
    return {
      state: this.state,
      setIndex: this.setIndex,
      repIndex: this.repIndex,
      remainingSec: this.remainingSec,
      totalSec: this.totalSec,
      paused: this.paused
    };
  }

  private _emitTick(): void {
    const snap = this.snapshot();
    this.tickCallbacks.forEach(cb => cb(snap));
  }

  private _emitStateChange(prevState: TimerState): void {
    const snap = this.snapshot();
    this.stateCallbacks.forEach(cb => cb(snap, prevState));
  }

  start(config: TimerConfig): void {
    this._clearInterval();
    this.config = { ...config };
    this.setIndex = 0;
    this.repIndex = 0;
    this.paused = false;
    this._enterState(STATES.WARMUP);
  }

  pause(): void {
    if (this.state === STATES.IDLE || this.state === STATES.DONE) return;
    if (this.paused) return;
    this.paused = true;
    this._clearInterval();
    this._emitTick();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this._startTicking();
    this._emitTick();
  }

  stop(): void {
    if (this.state === STATES.IDLE) return;
    this._clearInterval();
    const prev = this.state;
    this.state = STATES.IDLE;
    this.setIndex = 0;
    this.repIndex = 0;
    this.remainingSec = 0;
    this.totalSec = 0;
    this.paused = false;
    this._emitStateChange(prev);
  }

  private _clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private _startTicking(): void {
    this._clearInterval();
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  // 进入新状态：设置该状态时长、emit 事件、（非终态）启动 tick
  private _enterState(newState: TimerState): void {
    // 不变量：状态推进会由 start() 或其后续的 tick 触发，此处 config 必定已设置
    const cfg = this.config!;
    const prev = this.state;
    this.state = newState;

    switch (newState) {
      case STATES.WARMUP:
        // 热身时预置第一组第一次的索引（UI 在 WARMUP 时不显示组次）
        this.setIndex = 1;
        this.repIndex = 1;
        this.remainingSec = cfg.warmup;
        this.totalSec = cfg.warmup;
        break;
      case STATES.WORK:
        this.remainingSec = cfg.work;
        this.totalSec = cfg.work;
        break;
      case STATES.REST:
        this.remainingSec = cfg.rest;
        this.totalSec = cfg.rest;
        break;
      case STATES.BETWEEN_SETS:
        this.remainingSec = cfg.betweenSets;
        this.totalSec = cfg.betweenSets;
        break;
      case STATES.STRETCH:
        this.remainingSec = cfg.stretch;
        this.totalSec = cfg.stretch;
        break;
      case STATES.DONE:
        this.remainingSec = 0;
        this.totalSec = 0;
        break;
    }

    this._emitStateChange(prev);

    if (newState === STATES.IDLE || newState === STATES.DONE) {
      this._clearInterval();
    } else {
      this._startTicking();
    }
  }

  private _tick(): void {
    if (this.paused) return;
    // 上次已归零并显示了 0：现在推进到下一状态
    if (this.remainingSec <= 0) {
      this._advance();
      return;
    }
    this.remainingSec -= 1;
    this._emitTick();  // 归零（0）也会显示，让用户看到阶段真正结束
  }

  // 阶段倒计时归零后的状态推进
  private _advance(): void {
    const s = this.state;
    const cfg = this.config!;

    if (s === STATES.WARMUP) {
      this._enterState(STATES.WORK);
      return;
    }

    if (s === STATES.WORK) {
      if (this.repIndex >= cfg.repsPerSet) {
        // 当前组所有次数完成
        if (this.setIndex >= cfg.sets) {
          // 最后一组完成 -> 拉伸
          this._enterState(STATES.STRETCH);
        } else {
          // 还有下一组 -> 组间间隔
          this._enterState(STATES.BETWEEN_SETS);
        }
      } else {
        // 当前组还有次数 -> 休息后继续
        this.repIndex += 1;
        this._enterState(STATES.REST);
      }
      return;
    }

    if (s === STATES.REST) {
      this._enterState(STATES.WORK);
      return;
    }

    if (s === STATES.BETWEEN_SETS) {
      this.setIndex += 1;
      this.repIndex = 1;
      this._enterState(STATES.WORK);
      return;
    }

    if (s === STATES.STRETCH) {
      this._enterState(STATES.DONE);
      return;
    }
  }
}

window.HiitTimer = HiitTimer;
window.STATES = STATES;
window.STATE_LABELS = STATE_LABELS;

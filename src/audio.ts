// AudioPlayer: 使用 Web Audio API 程序生成音效，无外部音频文件依赖
// 设计原则：5 种音效全部用 sine 波，通过「频率 + 节奏 + 包络」区分，避免刺耳的方波
// 约束：AudioContext 必须在用户首次交互（点击按钮）后初始化，否则浏览器自动播放策略会阻止

class AudioPlayer {
  private ctx: AudioContext | null = null;

  // 在用户交互的同步上下文中调用，初始化并 resume AudioContext
  async ensureCtx(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // 播放单个稳频音调
  // freq: Hz, durationMs: 持续毫秒, type: 波形, startOffsetMs: 距今多少毫秒后开始
  playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', startOffsetMs = 0): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + startOffsetMs / 1000;
    const dur = durationMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    // 简化 ADSR：10ms 起音到峰值，指数衰减到接近 0
    const peak = 0.3;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // 播放频率渐变音调（用于组间间隔的双音渐变）
  playSlide(freqStart: number, freqEnd: number, durationMs: number, type: OscillatorType = 'sine', startOffsetMs = 0): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + startOffsetMs / 1000;
    const dur = durationMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.linearRampToValueAtTime(freqEnd, now + dur);
    const peak = 0.3;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // 热身开始：523Hz(C5) 长鸣 1.2s —— 中音、长持续，与短促的 work/rest 区分
  playWarmupStart(): void {
    this.playTone(523, 1200, 'sine');
  }

  // 拉伸开始：与热身开始同音（按需求复用同一实现）
  playStretchStart(): void {
    this.playWarmupStart();
  }

  // 锻炼开始：880Hz(A5) 双短鸣 —— 高频、双鸣，与休息的单短鸣区分
  playWorkStart(): void {
    this.playTone(880, 150, 'sine', 0);
    this.playTone(880, 150, 'sine', 220);
  }

  // 休息开始：440Hz(A4) 单短鸣 —— 低频、单鸣
  playRestStart(): void {
    this.playTone(440, 320, 'sine');
  }

  // 组间间隔开始：440→660Hz 渐变 0.5s —— 渐变特征，与其他稳频音区分
  playBetweenSetsStart(): void {
    this.playSlide(440, 660, 500, 'sine');
  }

  // 流程结束：523→659→784Hz 三连升调 —— 明显的终止感
  playDone(): void {
    this.playTone(523, 200, 'sine', 0);
    this.playTone(659, 200, 'sine', 230);
    this.playTone(784, 450, 'sine', 460);
  }
}

window.AudioPlayer = AudioPlayer;

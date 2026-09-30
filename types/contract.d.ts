// 跨进程 / 跨脚本共享的类型契约。
//
// 本文件同时被 Web 核心（tsconfig.json）与 Electron 宿主（tsconfig.electron.json）
// 引用，是两端唯一的事实来源：任意一侧改动契约，另一侧会立刻在类型检查中暴露。
// 纯声明文件（.d.ts），不含运行时代码，也不会产生构建产物。

/** 训练阶段标识 */
type TimerState =
  | 'idle'
  | 'warmup'
  | 'work'
  | 'rest'
  | 'between_sets'
  | 'stretch'
  | 'done';

/** 训练配置。renderer / storage / Electron 主进程三方共用同一形状。 */
interface TimerConfig {
  warmup: number;
  work: number;
  rest: number;
  betweenSets: number;
  stretch: number;
  sets: number;
  repsPerSet: number;
}

/** 计时器对外快照（onTick / onStateChange 的载荷） */
interface TimerSnapshot {
  state: TimerState;
  setIndex: number;
  repIndex: number;
  remainingSec: number;
  totalSec: number;
  paused: boolean;
}

/** preload 通过 contextBridge 暴露给渲染层的配置读写接口 */
interface TimerAPI {
  getConfig(): Promise<TimerConfig>;
  saveConfig(cfg: TimerConfig): Promise<boolean>;
}

/** preload 暴露的窗口控制接口，仅在 Electron 桌面端存在 */
interface WindowAPI {
  minimize(): Promise<void>;
  maximizeToggle(): Promise<boolean>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(cb: (isMax: boolean) => void): void;
}

/** Capacitor Preferences 插件的最小接口，由移动端运行时注入 */
interface PreferencesPlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
}

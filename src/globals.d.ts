// Web 核心的全局声明：宿主注入的桥接对象 + 跨脚本共享的全局构造器。
//
// 仅用于类型检查，不产生任何运行时代码。宿主侧的实现在 electron/preload.ts。
// src/ 下的四个文件都是经典脚本（无 import/export），通过全局作用域互相引用。

// contextBridge / Capacitor 运行时注入的全局变量。
//
// 这里刻意用 declare var 而不是 Window 属性声明：declare var 属于全局作用域，
// 因此脚本顶层若误写同名的 const/let，TypeScript 会直接报「重复声明」。
// 这类冲突在运行时是 SyntaxError，会让整个脚本失效——必须挡在编译期。
declare var timerAPI: TimerAPI | undefined;
declare var windowAPI: WindowAPI | undefined;
declare var Capacitor: { Plugins: { Preferences: PreferencesPlugin } } | undefined;

interface Window {
  /** audio.ts 导出 */
  AudioPlayer: typeof AudioPlayer;
  /** timer.ts 导出 */
  HiitTimer: typeof HiitTimer;
  STATES: typeof STATES;
  STATE_LABELS: typeof STATE_LABELS;
  /** storage.ts 导出 */
  ConfigStore: typeof ConfigStore;
}

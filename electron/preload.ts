import { contextBridge, ipcRenderer } from 'electron';

// 配置读写 API（storage.ts 通过 window.timerAPI 检测 Electron 环境）
const timerAPI: TimerAPI = {
  getConfig: () => ipcRenderer.invoke('config:get') as Promise<TimerConfig>,
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg) as Promise<boolean>
};

// 窗口控制 API（自定义标题栏按钮）
const windowAPI: WindowAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  maximizeToggle: () => ipcRenderer.invoke('window:maximize-toggle') as Promise<boolean>,
  close: () => ipcRenderer.invoke('window:close') as Promise<void>,
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  onMaximizeChange: (cb) => {
    ipcRenderer.on('window:maximized', (_event, isMax: boolean) => cb(isMax));
  }
};

contextBridge.exposeInMainWorld('timerAPI', timerAPI);
contextBridge.exposeInMainWorld('windowAPI', windowAPI);

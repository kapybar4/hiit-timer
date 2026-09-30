const { contextBridge, ipcRenderer } = require('electron');

// 配置读写 API（storage.js 通过 window.timerAPI 检测 Electron 环境）
contextBridge.exposeInMainWorld('timerAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg)
});

// 窗口控制 API（自定义标题栏按钮）
contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('window:maximize-toggle'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (cb) => {
    ipcRenderer.on('window:maximized', (_, isMax) => cb(isMax));
  }
});

// src/storage.js - 跨平台配置存储适配层
// 运行时检测宿主环境，统一接口供 renderer.js 使用：
//   - Electron:     IPC → 主进程 fs 读写 userData/config.json
//   - Capacitor:    Preferences 插件（Android/iOS 原生 KV 存储）
//   - 浏览器/PWA:   localStorage fallback
const Storage = {
  _isElectron() {
    return !!(window.timerAPI && typeof window.timerAPI.getConfig === 'function');
  },
  _isCapacitor() {
    return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences);
  },
  async load() {
    if (this._isElectron()) return await window.timerAPI.getConfig();
    if (this._isCapacitor()) {
      const { Preferences } = window.Capacitor.Plugins;
      const { value } = await Preferences.get({ key: 'hiit-config' });
      return value ? JSON.parse(value) : null;
    }
    try {
      const raw = localStorage.getItem('hiit-config');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  async save(cfg) {
    if (this._isElectron()) return await window.timerAPI.saveConfig(cfg);
    if (this._isCapacitor()) {
      const { Preferences } = window.Capacitor.Plugins;
      await Preferences.set({ key: 'hiit-config', value: JSON.stringify(cfg) });
      return true;
    }
    try {
      localStorage.setItem('hiit-config', JSON.stringify(cfg));
      return true;
    } catch (e) {
      console.error('保存失败', e);
      return false;
    }
  }
};
window.Storage = Storage;

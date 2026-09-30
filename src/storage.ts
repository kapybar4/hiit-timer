// src/storage.ts - 跨平台配置存储适配层
// 运行时检测宿主环境，统一接口供 renderer.ts 使用：
//   - Electron:     IPC → 主进程 fs 读写 userData/config.json
//   - Capacitor:    Preferences 插件（Android/iOS 原生 KV 存储）
//   - 浏览器/PWA:   localStorage fallback

const STORAGE_KEY = 'hiit-config';

const ConfigStore = {
  _preferences(): PreferencesPlugin | null {
    return window.Capacitor?.Plugins.Preferences ?? null;
  },

  async load(): Promise<TimerConfig | null> {
    const timerAPI = window.timerAPI;
    if (timerAPI) return await timerAPI.getConfig();

    const prefs = this._preferences();
    if (prefs) {
      const { value } = await prefs.get({ key: STORAGE_KEY });
      return value ? JSON.parse(value) as TimerConfig : null;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as TimerConfig : null;
    } catch {
      return null;
    }
  },

  async save(cfg: TimerConfig): Promise<boolean> {
    const timerAPI = window.timerAPI;
    if (timerAPI) return await timerAPI.saveConfig(cfg);

    const prefs = this._preferences();
    if (prefs) {
      await prefs.set({ key: STORAGE_KEY, value: JSON.stringify(cfg) });
      return true;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      return true;
    } catch (e) {
      console.error('保存失败', e);
      return false;
    }
  }
};

window.ConfigStore = ConfigStore;

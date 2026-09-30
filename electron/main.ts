import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let mainWindow: BrowserWindow | null = null;

// 配置默认值（与 src/index.html 初始值一致）
const DEFAULT_CONFIG: TimerConfig = {
  warmup: 60,
  work: 20,
  rest: 10,
  betweenSets: 30,
  stretch: 90,
  sets: 4,
  repsPerSet: 8
};

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

// 文件不存在或损坏时回退默认值；存在时合并到默认值（前向兼容新增字段）
function readConfig(): TimerConfig {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) as Partial<TimerConfig> };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// 仅写入已知字段且必须为有限数值（IPC 边界校验）
function writeConfig(cfg: unknown): boolean {
  const source = (cfg ?? {}) as Record<string, unknown>;
  const data: Partial<TimerConfig> = {};
  for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof TimerConfig>) {
    const v = Number(source[key]);
    if (Number.isFinite(v)) data[key] = v;
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(data, null, 2));
  return true;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 440,
    height: 820,
    minWidth: 380,
    minHeight: 820,
    resizable: true,
    frame: false,            // 无系统标题栏，由渲染层自定义
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#08080c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = win;

  // src/ 在 electron/ 的上级目录
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // 最大化状态变化 → 通知渲染层切换标题栏图标
  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));

  // Electron 36+ 新签名：单 details 对象（旧的多参数形式已弃用）
  win.webContents.on('console-message', ({ level, message }) => {
    const tag = level === 'error' ? '[renderer:error]' : '[renderer]';
    console.log(tag, message);
  });
}

app.whenReady().then(() => {
  // 窗口控制（自定义标题栏按钮）
  ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
  ipcMain.handle('window:maximize-toggle', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => { mainWindow?.close(); });
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

  // 配置读写（storage.ts → preload timerAPI → 此处）
  ipcMain.handle('config:get', () => readConfig());
  ipcMain.handle('config:save', (_event, cfg: unknown) => writeConfig(cfg));

  Menu.setApplicationMenu(null);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

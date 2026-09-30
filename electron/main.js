const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// 配置默认值（与 src/index.html 初始值一致）
const DEFAULT_CONFIG = {
  warmup: 60,
  work: 20,
  rest: 10,
  betweenSets: 30,
  stretch: 90,
  sets: 4,
  repsPerSet: 8
};

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

// 文件不存在或损坏时回退默认值；存在时合并到默认值（前向兼容新增字段）
function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// 仅写入已知字段且必须为有限数值（IPC 边界校验）
function writeConfig(cfg) {
  const data = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const v = Number(cfg?.[key]);
    if (Number.isFinite(v)) data[key] = v;
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(data, null, 2));
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
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

  // src/ 在 electron/ 的上级目录
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // 最大化状态变化 → 通知渲染层切换标题栏图标
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));

  // Electron 36+ 新签名：单 details 对象（旧的多参数形式已弃用）
  mainWindow.webContents.on('console-message', ({ level, message }) => {
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

  // 配置读写（storage.js → preload timerAPI → 此处）
  ipcMain.handle('config:get', () => readConfig());
  ipcMain.handle('config:save', (_event, cfg) => writeConfig(cfg));

  Menu.setApplicationMenu(null);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

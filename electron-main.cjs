// Electron main process with verbose logging for debugging
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function log(...args) { console.log('[main]', ...args); }

process.on('uncaughtException', err => { console.error('[main] uncaughtException', err); });
process.on('unhandledRejection', err => { console.error('[main] unhandledRejection', err); });

function createWindow() {
  log('Creating window');
  const win = new BrowserWindow({
    width: 640,
    height: 700,
    resizable: false,
    title: 'Tetris',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  // Remove default menu ribbon
  try { Menu.setApplicationMenu(null); } catch {}
  try { win.setMenuBarVisibility(false); } catch {}
  win.on('closed', () => {
    log('Window closed');
  });
  win.webContents.on('did-finish-load', () => log('did-finish-load'));
  win.webContents.on('dom-ready', () => log('dom-ready'));
  win.webContents.on('did-fail-load', (_e, ec, desc) => log('did-fail-load', ec, desc));
  const dev = process.env.NODE_ENV === 'development';
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/';
  log('Mode:', dev ? 'development' : 'production', 'URL:', devUrl);
  if (dev) {
    win.loadURL(devUrl);
    win.webContents.once('did-fail-load', () => {
      setTimeout(() => { log('Retrying loadURL'); win.loadURL(devUrl); }, 300);
    });
    const wantDevTools = process.env.OPEN_DEVTOOLS === '1';
    if (wantDevTools) {
      log('Opening DevTools (OPEN_DEVTOOLS=1)');
      try { win.webContents.openDevTools({ mode: 'detach' }); } catch (e) { log('DevTools open failed', e); }
    } else {
      log('DevTools suppressed. Set OPEN_DEVTOOLS=1 to enable.');
    }
  } else {
    const filePath = path.join(__dirname, 'dist', 'index.html');
    log('Loading file', filePath);
    win.loadFile(filePath);
  }
}

app.whenReady().then(() => {
  log('App ready');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => log('before-quit'));
app.on('will-quit', () => log('will-quit'));
app.on('quit', () => log('quit'));

app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') app.quit();
});

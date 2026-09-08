import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAppSnapshot, writeAppSnapshot, ensureAppDataDir } from './desktop-storage.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const appDataRoot = ensureAppDataDir('PharmaStock');

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f0fdfa',
    title: 'PharmaStock',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${join(__dirname, 'index.html')}`;
  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    app.quit();
  });
});

ipcMain.handle('read-snapshot', () => {
  return readAppSnapshot('PharmaStock');
});

ipcMain.handle('write-snapshot', (_event, snapshot) => {
  const file = writeAppSnapshot('PharmaStock', snapshot);
  return { success: true, file };
});

ipcMain.handle('app-data-path', () => appDataRoot);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    app.whenReady().then(() => {
      const win = new BrowserWindow({
        width: 1320,
        height: 900,
        webPreferences: { preload: join(__dirname, 'preload.js') }
      });
      win.loadURL(process.env.ELECTRON_START_URL || `file://${join(__dirname, 'index.html')}`);
    });
  }
});

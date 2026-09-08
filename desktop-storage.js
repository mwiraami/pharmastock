import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';

export function getApplicationDataDir(appName = 'PharmaStock') {
  const platform = process.platform;

  const safeAppName = appName && isAbsolute(appName)
    ? appName
    : appName || 'PharmaStock';

  if (platform === 'win32') {
    const baseDir = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return isAbsolute(safeAppName) ? safeAppName : join(baseDir, safeAppName);
  }

  if (platform === 'darwin') {
    return isAbsolute(safeAppName) ? safeAppName : join(homedir(), 'Library', 'Application Support', safeAppName);
  }

  return isAbsolute(safeAppName) ? safeAppName : join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), safeAppName);
}

export function ensureAppDataDir(appName = 'PharmaStock') {
  const dir = getApplicationDataDir(appName);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDataFilePath(appName = 'PharmaStock') {
  return join(ensureAppDataDir(appName), 'pharmastock-data.json');
}

export function readAppSnapshot(appName = 'PharmaStock') {
  const file = getDataFilePath(appName);
  if (!existsSync(file)) return null;

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeAppSnapshot(appName = 'PharmaStock', snapshot) {
  const file = getDataFilePath(appName);
  const payload = snapshot && typeof snapshot === 'object' ? snapshot : { updatedAt: new Date().toISOString(), data: snapshot ?? {} };
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return file;
}

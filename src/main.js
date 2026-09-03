const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const { fetchProfile } = require('./providers');

let db;

function initDb() {
  const dbPath = path.join(app.getPath('userData'), 'tiktok-fake-acc.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      user_id TEXT,
      unique_id TEXT NOT NULL,
      nickname TEXT,
      bio TEXT,
      avatar_url TEXT,
      follower_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      video_count INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      region TEXT,
      raw_json TEXT,
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, unique_id)
    );
  `);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#090b10',
    title: 'TikTok Fake Account Analyzer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
}

function saveProfile(profile) {
  db.prepare(`
    INSERT INTO profiles(provider,user_id,unique_id,nickname,bio,avatar_url,follower_count,following_count,likes_count,video_count,verified,region,raw_json)
    VALUES(@provider,@user_id,@unique_id,@nickname,@bio,@avatar_url,@follower_count,@following_count,@likes_count,@video_count,@verified,@region,@raw_json)
    ON CONFLICT(provider, unique_id) DO UPDATE SET
      user_id=excluded.user_id,nickname=excluded.nickname,bio=excluded.bio,avatar_url=excluded.avatar_url,
      follower_count=excluded.follower_count,following_count=excluded.following_count,likes_count=excluded.likes_count,
      video_count=excluded.video_count,verified=excluded.verified,region=excluded.region,raw_json=excluded.raw_json,
      last_seen_at=CURRENT_TIMESTAMP
  `).run(profile);
}

app.whenReady().then(() => {
  initDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('settings:get', (_, key) => getSetting(key));
ipcMain.handle('settings:set', (_, key, value) => {
  db.prepare(`INSERT INTO settings(key, value) VALUES(?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, String(value || ''));
  return true;
});

ipcMain.handle('profiles:list', () => db.prepare('SELECT * FROM profiles ORDER BY last_seen_at DESC LIMIT 250').all());
ipcMain.handle('profiles:save', (_, profile) => { saveProfile(profile); return true; });

ipcMain.handle('profile:fetch', async (_, provider, handle) => {
  const settings = {
    eulerKey: getSetting('eulerKey'),
    eulerBaseUrl: getSetting('eulerBaseUrl') || 'https://api.eulerstream.com',
    tikapiKey: getSetting('tikapiKey'),
    customKey: getSetting('customKey'),
    customTemplate: getSetting('customTemplate')
  };
  const profile = await fetchProfile(provider, handle, settings);
  saveProfile(profile);
  return profile;
});

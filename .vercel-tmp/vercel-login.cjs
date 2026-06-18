#!/usr/bin/env node
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
const ALLOWED_COMMANDS = new Set(['vercel']);
function log(msg) { console.error(msg); }
function commandExists(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd)) throw new Error(`Command not in whitelist: ${cmd}`);
  try {
    if (isWindows) { const r = spawnSync('where', [cmd], { stdio: 'ignore' }); return r.status === 0; }
    else { const r = spawnSync('sh', ['-c', `command -v "$1"`, '--', cmd], { stdio: 'ignore' }); return r.status === 0; }
  } catch { return false; }
}
function getCommandOutput(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], shell: isWindows });
    return r.status === 0 ? (r.stdout || '').trim() : null;
  } catch { return null; }
}

function createSecureLogFile() {
  const tmpDir = path.join(process.cwd(), '.vercel-tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  if (!isWindows) { try { fs.chmodSync(tmpDir, 0o700); } catch (e) {} }
  return path.join(tmpDir, 'login.log');
}
const LOG_FILE = createSecureLogFile();

function checkVercelInstalled() {
  if (!commandExists('vercel')) { log('Vercel CLI not installed'); process.exit(1); }
  log(`Vercel: ${getCommandOutput('vercel', ['--version']) || 'ok'}`);
}
function checkLoginStatus() {
  try {
    const r = spawnSync('vercel', ['whoami'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
    const o = (r.stdout || '').trim();
    if (r.status === 0 && o && !o.includes('Error') && !o.includes('not logged in')) { log(`Logged in as: ${o}`); return true; }
  } catch {}
  return false;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function startBackgroundLogin() {
  const logStream = fs.openSync(LOG_FILE, 'w');
  const child = spawn('vercel', ['login'], { detached: true, stdio: ['ignore', logStream, logStream], shell: isWindows });
  child.unref();
  log(`Login process started (PID: ${child.pid})`);
  const pidFile = LOG_FILE + '.pid';
  fs.writeFileSync(pidFile, String(child.pid));
  return child.pid;
}
function openBrowser(url) {
  const urlPattern = /^https:\/\/vercel\.com\/oauth\/device\?user_code=[A-Z0-9-]+$/;
  if (!urlPattern.test(url)) { log(`URL pattern mismatch: ${url}`); return; }
  try {
    if (os.platform() === 'darwin') spawnSync('open', [url], { stdio: 'ignore' });
    else if (isWindows) spawnSync('powershell', ['-Command', `Start-Process '${url}'`], { stdio: 'ignore', windowsHide: true });
    else spawnSync('xdg-open', [url], { stdio: 'ignore' });
    log('Browser opened');
  } catch (e) { log(`Browser open failed: ${e.message}`); }
}
async function waitForAuthUrl() {
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      if (fs.existsSync(LOG_FILE)) {
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        const match = content.match(/https:\/\/vercel\.com\/oauth\/device\?user_code=[A-Z0-9-]+(?=\s|$)/);
        if (match) return match[0];
      }
    } catch (e) { if (e.code !== 'ENOENT') log(`Warning: ${e.code || e.message}`); }
  }
  return null;
}
async function doLogin() {
  log('Starting login...');
  const loginPid = startBackgroundLogin();
  log('Waiting for auth URL...');
  const authUrl = await waitForAuthUrl();
  if (authUrl) {
    log(`Auth URL: ${authUrl}`);
    openBrowser(authUrl);
    console.log(JSON.stringify({ status: 'needs_auth', auth_url: authUrl, log_file: LOG_FILE }));
  } else {
    log('Failed to get auth URL');
    process.exit(1);
  }
}
async function main() {
  log('=== Vercel Login ===');
  checkVercelInstalled();
  if (checkLoginStatus()) { log('Already logged in.'); console.log(JSON.stringify({ status: 'already_logged_in' })); process.exit(0); }
  await doLogin();
}
main();

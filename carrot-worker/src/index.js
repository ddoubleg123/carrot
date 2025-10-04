const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
// Optional cookie broker configuration (for auto-fetch/refresh)
const COOKIE_FETCH_URL = process.env.COOKIE_FETCH_URL || '';
const COOKIE_FETCH_SECRET = process.env.COOKIE_FETCH_SECRET || '';

// Default polite client profile for yt-dlp
const DEFAULT_UA = process.env.YTDLP_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DEFAULT_ACCEPT_LANG = process.env.YTDLP_ACCEPT_LANGUAGE || 'en-US,en;q=0.9';

// Boot banner to help verify which commit is running in container logs
console.log('[BOOT] carrot-worker starting', {
  commit: process.env.RELEASE_SHA || process.env.GITHUB_SHA || process.env.RENDER_GIT_COMMIT || 'unknown',
  cookieMethod: process.env.YT_DLP_COOKIES_FROM_BROWSER ? 'browser' : 'file'
});

// Lightweight fetch helper (uses global fetch if available; falls back to node-fetch)
async function doFetch(input, init) {
  if (typeof fetch === 'function') return fetch(input, init);
  const mod = await import('node-fetch');
  return mod.default(input, init);
}

// Runtime tool installation
async function installVideoTools() {
  console.log('[STARTUP] Installing video processing tools...');
  const pExecFile = promisify(execFile);

  // Fast path: if both tools are available, skip installation
  try {
    await pExecFile('yt-dlp', ['--version']);
    await pExecFile('ffmpeg', ['-version']);
    console.log('[STARTUP] Video tools already available; skipping installation');
    return;
  } catch (_) {
    // Continue to best-effort installation
  }
  
  try {
    // Try installing yt-dlp. Prefer pip (pip3/pip) with --user; otherwise fall back to direct download to a user-writable bin.
    console.log('[STARTUP] Installing yt-dlp...');
    const candidates = ['pip3', 'pip'];
    let installedViaPip = false;
    for (const pipCmd of candidates) {
      try {
        await pExecFile(pipCmd, ['--version']);
        await pExecFile(pipCmd, ['install', '--user', '--upgrade', 'yt-dlp']);
        installedViaPip = true;
        console.log(`[STARTUP] yt-dlp installed successfully via ${pipCmd} --user`);
        break;
      } catch (_) {}
    }
    if (!installedViaPip) {
      console.log('[STARTUP] pip/pip3 not available or failed; attempting direct download to user bin...');
      try {
        const userBin = path.join(os.homedir(), '.local', 'bin');
        await fs.promises.mkdir(userBin, { recursive: true }).catch(() => {});
        const target = path.join(userBin, 'yt-dlp');
        await pExecFile('curl', ['-L', 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', '-o', target]);
        await pExecFile('chmod', ['a+rx', target]);
        console.log('[STARTUP] yt-dlp installed successfully via direct download to', target);
      } catch (dlError) {
        console.log(`[STARTUP] Failed to install yt-dlp via direct download: ${dlError?.message}`);
      }
    }

    // Ensure ffmpeg exists; if not, log and continue (image should already provide it)
    try {
      await pExecFile('ffmpeg', ['-version']);
      console.log('[STARTUP] ffmpeg already available');
    } catch (e) {
      console.log('[STARTUP] ffmpeg not found; runtime installation is not supported in this environment');
    }

    console.log('[STARTUP] Video processing tools installation completed');
  } catch (error) {
    console.error('[STARTUP] Failed to install video tools:', error.message);
    console.error('[STARTUP] Service will continue without video processing capabilities');
  }
}

// Error handling and monitoring
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Health check endpoint with detailed status
app.get('/healthz', (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development',
    services: {
      redis: process.env.REDIS_URL ? 'configured' : 'missing',
      firebase: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'configured' : 'missing',
      storage: process.env.FIREBASE_STORAGE_BUCKET ? 'configured' : 'missing'
    }
  };
  
  console.log('[HEALTH] Health check requested:', health);
  res.status(200).json(health);
});

// Basic info endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'carrot-ingest-worker',
    version: '0.1.0',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: PORT,
      REDIS_URL: process.env.REDIS_URL ? 'SET' : 'MISSING',
      INGEST_WORKER_SECRET: process.env.INGEST_WORKER_SECRET ? 'SET' : 'MISSING',
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ? 'SET' : 'MISSING',
      GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'SET' : 'MISSING'
    }
  });
});

app.get('/livez', (req, res) => {
  res.status(200).send('ok');
});

app.get('/readyz', (req, res) => {
  res.status(200).send('ok');
});

// Enhanced debug endpoint to inspect container environment
const pExecFile = promisify(execFile);

function getVersion(bin) {
  try {
    const args = bin === 'yt-dlp' ? ['--version'] : ['-version'];
    const result = require('child_process').spawnSync(bin, args, { encoding: 'utf8' });
    if (result.error) return `ERR: ${result.error.message}`;
    const out = (result.stdout || result.stderr || '').split('\n')[0].trim();
    return out || 'unknown';
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

app.get('/debug', async (req, res) => {
  const paths = (process.env.PATH || '').split(':');
  const checkPaths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp', 
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/home/nodejs/.local/bin/yt-dlp',
    '/home/node/.local/bin/yt-dlp'
  ].map(p => ({ path: p, exists: fs.existsSync(p) }));

  let whoami = 'unknown';
  try {
    whoami = require('child_process').spawnSync('whoami', [], { encoding: 'utf8' }).stdout.trim();
  } catch (e) {
    whoami = `error: ${e.message}`;
  }

  const result = {
    deployment: {
      timestamp: new Date().toISOString(),
      commit: process.env.RELEASE_SHA || process.env.GITHUB_SHA || process.env.RENDER_GIT_COMMIT || 'unknown'
    },
    container: {
      user: process.getuid ? process.getuid() : 'N/A',
      whoami: whoami,
      node: process.version,
      PATH: process.env.PATH,
      cwd: process.cwd()
    },
    env: {
      INGEST_CALLBACK_URL: process.env.INGEST_CALLBACK_URL,
      WORKER_PUBLIC_URL: process.env.WORKER_PUBLIC_URL,
      HAS_CALLBACK_SECRET: Boolean(process.env.INGEST_WORKER_SECRET),
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      HAS_GOOGLE_APPLICATION_CREDENTIALS: Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) ||
        (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
      ),
      PORT: process.env.PORT || 8080,
      YT_DLP_PATH: process.env.YT_DLP_PATH,
      YT_DLP_COOKIES: process.env.YT_DLP_COOKIES,
      YT_DLP_COOKIES_URL: process.env.YT_DLP_COOKIES_URL,
      YT_DLP_COOKIES_FILE: process.env.YT_DLP_COOKIES_FILE,
      HAS_YT_DLP_COOKIES_B64: Boolean(process.env.YT_DLP_COOKIES_B64),
      YT_DLP_COOKIES_FROM_BROWSER: process.env.YT_DLP_COOKIES_FROM_BROWSER,
      YT_DLP_COOKIES_FROM_BROWSER_PROFILE: process.env.YT_DLP_COOKIES_FROM_BROWSER_PROFILE,
      INGEST_TRIM_SECONDS: process.env.INGEST_TRIM_SECONDS,
    },
    binaries: checkPaths,
    tools: {
      'yt-dlp': getVersion('yt-dlp'),
      'ffmpeg': getVersion('ffmpeg')
    }
  };
  // Enrich with cookies/secrets diagnostics
  try {
    const envPath = (process.env.YT_DLP_COOKIES_FILE || '').trim();
    const envPathExists = envPath ? fs.existsSync(envPath) : false;
    const defaultSecret = '/etc/secrets/yt_cookies.txt';
    const defaultSecretExists = fs.existsSync(defaultSecret);
    const detectedPath = await getCookiesFilePath();
    const detectedExists = detectedPath ? fs.existsSync(detectedPath) : false;
    let secretsList = [];
    try {
      secretsList = fs.existsSync('/etc/secrets') ? fs.readdirSync('/etc/secrets') : [];
    } catch (_) {}
    result.cookies = {
      envPath,
      envPathExists,
      defaultSecret,
      defaultSecretExists,
      detectedPath,
      detectedExists,
      secretsDir: '/etc/secrets',
      secretsList,
    };
  } catch (e) {
    result.cookies = { error: e?.message };
  }

  res.status(200).json(result);
});

// Utilities
async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

function isYouTube(url, type) {
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();
    return type === 'youtube' || host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return type === 'youtube';
  }
}

// Cookies management and yt-dlp helpers
let COOKIES_FILE_PATH = null; // from env/mounted secrets
let JOB_COOKIES_OVERRIDE = null; // per-request temp path
const COOKIES_CACHE = Object.create(null); // { [userId]: { path, expiresAt } }
const COOKIES_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function putCookiesForUser(userId, contentBuffer) {
  const tmp = path.join(os.tmpdir(), `yt_cookies_${userId}_${Date.now()}.txt`);
  fs.writeFileSync(tmp, contentBuffer, { mode: 0o600 });
  COOKIES_CACHE[userId] = { path: tmp, expiresAt: Date.now() + COOKIES_TTL_MS };
  console.log('[INGEST] Cached cookies for user:', userId, 'ttlMs=', COOKIES_TTL_MS);
  return tmp;
}

function getCachedCookiesForUser(userId) {
  const entry = COOKIES_CACHE[userId];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    try { if (fs.existsSync(entry.path)) fs.unlinkSync(entry.path); } catch {}
    delete COOKIES_CACHE[userId];
    return null;
  }
  return entry.path;
}

async function fetchAndCacheCookies(userId, force = false) {
  if (!userId) throw new Error('fetchAndCacheCookies: userId required');
  if (!COOKIE_FETCH_URL || !COOKIE_FETCH_SECRET) throw new Error('COOKIE_FETCH_URL/SECRET not configured');
  if (!force) {
    const cached = getCachedCookiesForUser(userId);
    if (cached) return { path: cached };
  }
  const url = COOKIE_FETCH_URL.includes('?')
    ? `${COOKIE_FETCH_URL}&userId=${encodeURIComponent(userId)}`
    : `${COOKIE_FETCH_URL}?userId=${encodeURIComponent(userId)}`;
  const headers = {
    'Authorization': `Bearer ${COOKIE_FETCH_SECRET}`,
    'ngrok-skip-browser-warning': 'true',
  };
  let res;
  try {
    res = await doFetch(url, { headers });
  } catch (e) {
    throw new Error(`cookie fetch network error: ${e?.message}`);
  }
  if (!res.ok) throw new Error(`cookie fetch ${res.status}`);
  const data = await res.json();
  const b64 = data?.cookies_b64 || data?.b64;
  if (!b64 || typeof b64 !== 'string' || !b64.trim()) throw new Error('cookie fetch returned empty');
  let buf;
  try { buf = Buffer.from(b64.trim(), 'base64'); } catch { throw new Error('cookie fetch invalid base64'); }
  const filePath = putCookiesForUser(userId, buf);
  return { path: filePath, ua: data?.ua, client: data?.playerClient };
}

function looksLikeCookieExpiry(msg = '') {
  const s = String(msg || '');
  return /cookies?.*no longer valid/i.test(s)
    || /confirm you.?re not a bot/i.test(s)
    || /HTTP Error\s*(429|403)/i.test(s)
    || /Please sign in/i.test(s);
}

function appendYtClientArgs(args, ua, playerClient) {
  const out = [...args,
    '--force-ipv4',
    '--user-agent', ua || DEFAULT_UA,
    '--add-header', `Accept-Language: ${DEFAULT_ACCEPT_LANG}`,
    '--sleep-requests', '1',
    '--retries', '10',
    '--retry-sleep', '1',
    '--concurrent-fragments', '1',
  ];
  if (playerClient) out.push('--extractor-args', `youtube:player_client=${playerClient}`);
  return out;
}

async function getCookiesFilePath() {
  // Prefer env b64/plain
  const b64 = (process.env.YT_DLP_COOKIES_B64 || '').trim();
  if (b64) {
    const tmp = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
    try {
      const buf = Buffer.from(b64, 'base64');
      fs.writeFileSync(tmp, buf, { mode: 0o600 });
      COOKIES_FILE_PATH = tmp;
      console.log('[INGEST] Using cookies from YT_DLP_COOKIES_B64 env:', tmp);
      return tmp;
    } catch (e) {
      console.warn('[INGEST] Failed to write YT_DLP_COOKIES_B64 to temp file:', e?.message);
    }
  }
  const plain = (process.env.YT_DLP_COOKIES || '').trim();
  if (plain) {
    const tmp = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
    try {
      fs.writeFileSync(tmp, plain, { mode: 0o600 });
      COOKIES_FILE_PATH = tmp;
      console.log('[INGEST] Using cookies from YT_DLP_COOKIES env:', tmp);
      return tmp;
    } catch (e) {
      console.warn('[INGEST] Failed to write YT_DLP_COOKIES to temp file:', e?.message);
    }
  }

  // Explicit file path
  const filePath = (process.env.YT_DLP_COOKIES_FILE || '').trim();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath);
      const tmpCopy = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      fs.writeFileSync(tmpCopy, data, { mode: 0o600 });
      COOKIES_FILE_PATH = tmpCopy;
      console.log('[INGEST] Using temp copy of cookies from file path:', tmpCopy);
      return tmpCopy;
    } catch (e) {
      console.warn('[INGEST] Failed to read cookies file path, will try other sources:', filePath, e?.message);
    }
  }

  // Common secret mount locations
  try {
    const defaultSecret = '/etc/secrets/yt_cookies.txt';
    if (fs.existsSync(defaultSecret)) {
      try {
        const data = fs.readFileSync(defaultSecret);
        const tmpCopy = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
        fs.writeFileSync(tmpCopy, data, { mode: 0o600 });
        COOKIES_FILE_PATH = tmpCopy;
        console.log('[INGEST] Using temp copy of default secret cookies file:', tmpCopy);
        return tmpCopy;
      } catch (e) {
        console.warn('[INGEST] Cannot read default secret cookies file, need env fallback:', e?.message);
      }
    }
    const altSecret = '/etc/secrets/YT_DLP_COOKIES_FILE';
    if (fs.existsSync(altSecret)) {
      try {
        const data = fs.readFileSync(altSecret);
        const tmpCopy = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
        fs.writeFileSync(tmpCopy, data, { mode: 0o600 });
        COOKIES_FILE_PATH = tmpCopy;
        console.log('[INGEST] Using temp copy of alt secret cookies file:', tmpCopy);
        return tmpCopy;
      } catch (e) {
        console.warn('[INGEST] Cannot read alt secret cookies file, need env fallback:', e?.message);
      }
    }
  } catch (_) {}

  COOKIES_FILE_PATH = '';
  return '';
}

async function withCookiesArgs(args = []) {
  try {
    if (JOB_COOKIES_OVERRIDE && fs.existsSync(JOB_COOKIES_OVERRIDE)) {
      console.log('[INGEST] Using per-request cookies override at:', JOB_COOKIES_OVERRIDE);
      return [...args, '--cookies', JOB_COOKIES_OVERRIDE];
    }
  } catch (_) {}

  const file = await getCookiesFilePath();
  if (file) return [...args, '--cookies', file];
  const fromBrowser = (process.env.YT_DLP_COOKIES_FROM_BROWSER || '').trim();
  if (fromBrowser) {
    const profile = (process.env.YT_DLP_COOKIES_FROM_BROWSER_PROFILE || '').trim();
    const browserArg = profile ? `${fromBrowser}:${profile}` : fromBrowser;
    return [...args, '--cookies-from-browser', browserArg];
  }
  return args;
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const err = new Error(`${cmd} ${args.join(' ')} exited with ${code}: ${stderr || stdout}`);
      err.code = code;
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

function tryRequireStorage() {
  try {
    // Lazy require to avoid hard crash if dependency is missing
    // Ensure package: @google-cloud/storage is added to carrot-worker/package.json
    // e.g., "@google-cloud/storage": "^7"
    const { Storage } = require('@google-cloud/storage');
    return Storage;
  } catch (e) {
    console.error('[INGEST] Missing dependency @google-cloud/storage. Please add it to package.json:', e.message);
    return null;
  }
}

// Upload a file to Firebase Storage / GCS and return a public or signed URL
async function uploadFileToFirebase(localPath, destPath) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('FIREBASE_STORAGE_BUCKET not set');

  const Storage = tryRequireStorage();
  if (!Storage) throw new Error('Missing @google-cloud/storage');

  // Support multiple credential forms:
  // 1) GOOGLE_APPLICATION_CREDENTIALS_JSON (full JSON string)
  // 2) Individual env vars: GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY, GCP_PROJECT_ID/FIREBASE_PROJECT_ID
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  let storageOptions;
  if (credsJson) {
    storageOptions = { credentials: JSON.parse(credsJson) };
  } else {
    const client_email = process.env.FIREBASE_CLIENT_EMAIL || process.env.GCS_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
    let private_key = process.env.FIREBASE_PRIVATE_KEY || process.env.GCS_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
    const project_id = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID;
    if (client_email && private_key) {
      // Normalize escaped newlines
      private_key = private_key.replace(/\\n/g, '\n');
      storageOptions = { credentials: { client_email, private_key, project_id } };
    }
  }

  const storage = new Storage(storageOptions);
  const bucket = storage.bucket(bucketName);
  await bucket.upload(localPath, { destination: destPath, resumable: false, contentType: undefined });
  const file = bucket.file(destPath);
  // Try to make public; if not allowed, fall back to signed URL
  try {
    await file.makePublic();
    // Prefer Firebase domain if available
    if ((bucketName || '').endsWith('firebasestorage.app')) {
      const encoded = encodeURIComponent(destPath);
      return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
    }
    return `https://storage.googleapis.com/${bucketName}/${encodeURI(destPath)}`;
  } catch {
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    return signedUrl;
  }
}

async function generateThumbnail(inputVideoPath, outputThumbPath) {
  // Capture a frame at ~2s
  await run('ffmpeg', ['-y', '-ss', '2', '-i', inputVideoPath, '-frames:v', '1', '-q:v', '2', outputThumbPath]);
}

async function downloadYouTubeAsMp4(url, outDir, hints = {}) {
  const outTemplate = path.join(outDir, 'video.%(ext)s');
  // Prefer mp4. If not available, merge best and force mp4 container
  const baseArgs = [
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '--merge-output-format', 'mp4',
    '-o', outTemplate,
    url
  ];
  const argsWithCookies = await withCookiesArgs(baseArgs);
  const args = appendYtClientArgs(argsWithCookies, hints.ua, hints.playerClient);
  await run('yt-dlp', args);
  // Determine resulting file
  const entries = await fs.promises.readdir(outDir);
  const videoFile = entries.find(f => f.startsWith('video.') && (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm') || f.endsWith('.mov')));
  if (!videoFile) throw new Error('yt-dlp did not produce a video file');
  let fullPath = path.join(outDir, videoFile);
  if (!fullPath.endsWith('.mp4')) {
    // Transcode to mp4
    const mp4Path = path.join(outDir, 'video.mp4');
    await run('ffmpeg', ['-y', '-i', fullPath, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', mp4Path]);
    fullPath = mp4Path;
  }
  return fullPath;
}

async function downloadAudioAsMp3(url, outDir, hints = {}) {
  const outTemplate = path.join(outDir, 'audio.%(ext)s');
  const baseArgs = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', outTemplate, url];
  const argsWithCookies = await withCookiesArgs(baseArgs);
  const args = appendYtClientArgs(argsWithCookies, hints.ua, hints.playerClient);
  await run('yt-dlp', args);
  const entries = await fs.promises.readdir(outDir);
  const audioFile = entries.find(f => f.startsWith('audio.') && f.endsWith('.mp3'))
    || entries.find(f => f.startsWith('audio.'));
  if (!audioFile) throw new Error('yt-dlp did not produce an audio file');
  let fullPath = path.join(outDir, audioFile);
  if (!fullPath.endsWith('.mp3')) {
    const mp3Path = path.join(outDir, 'audio.mp3');
    await run('ffmpeg', ['-y', '-i', fullPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3Path]);
    fullPath = mp3Path;
  }
  return fullPath;
}

async function fetchYtMetadata(url, hints = {}) {
  try {
    const argsWithCookies = await withCookiesArgs(['-J', url]);
    const args = appendYtClientArgs(argsWithCookies, hints.ua, hints.playerClient);
    const { stdout } = await run('yt-dlp', args);
    return JSON.parse(stdout);
  } catch (e) {
    console.warn('[INGEST] Failed to fetch yt-dlp metadata:', e.message);
    return null;
  }
}

async function sendCallback(jobId, payload = {}) {
  if (!process.env.INGEST_CALLBACK_URL) {
    console.log('[INGEST] No INGEST_CALLBACK_URL set; skipping callback');
    return;
  }
  try {
    const body = { jobId, ...payload };
    const res = await fetch(process.env.INGEST_CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('[INGEST] Callback response', res.status, text);
  } catch (e) {
    console.error('[INGEST] Callback failed:', e.message);
  }
}

// Placeholder ingest function
async function runIngest(request) {
  console.log('[INGEST] Starting job:', request.id);
  console.log('[INGEST] URL:', request.url);
  console.log('[INGEST] Type:', request.type);
  const jobId = request.id;
  let url = request.url;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(url)) {
      const dec = decodeURIComponent(url);
      try { new URL(dec); url = dec; } catch {}
    }
  } catch {}
  const type = request.type;

  const baseDir = path.join(os.tmpdir(), 'jobs', jobId);
  await ensureDir(baseDir);

  // Prepare per-request cookies if provided; otherwise use broker for userId (if configured)
  let jobCookieTmp = null;
  let brokerHints = { ua: undefined, playerClient: undefined };
  try {
    if (request.cookies_b64 && typeof request.cookies_b64 === 'string' && request.cookies_b64.trim().length > 0) {
      jobCookieTmp = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      const buf = Buffer.from(request.cookies_b64.trim(), 'base64');
      fs.writeFileSync(jobCookieTmp, buf, { mode: 0o600 });
      JOB_COOKIES_OVERRIDE = jobCookieTmp;
      console.log('[INGEST] Using per-request cookies (b64) at:', jobCookieTmp);
    } else if (request.cookies && typeof request.cookies === 'string' && request.cookies.trim().length > 0) {
      jobCookieTmp = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      fs.writeFileSync(jobCookieTmp, request.cookies.trim(), { mode: 0o600 });
      JOB_COOKIES_OVERRIDE = jobCookieTmp;
      console.log('[INGEST] Using per-request cookies (plain) at:', jobCookieTmp);
    } else if (request.userId && COOKIE_FETCH_URL && COOKIE_FETCH_SECRET) {
      try {
        const fetched = await fetchAndCacheCookies(request.userId);
        if (fetched?.path) {
          JOB_COOKIES_OVERRIDE = fetched.path;
          brokerHints.ua = fetched.ua || brokerHints.ua;
          brokerHints.playerClient = fetched.client || brokerHints.playerClient;
          console.log('[INGEST] Using broker cookies for userId', request.userId, 'at:', fetched.path);
        }
      } catch (e) {
        console.warn('[INGEST] Broker cookie fetch failed:', e?.message);
      }
    }
  } catch (e) {
    console.warn('[INGEST] Failed to prepare per-request cookies:', e?.message);
  }

  const isYT = isYouTube(url, type);
  const meta = isYT ? await fetchYtMetadata(url, brokerHints) : null;

  let videoPath = null;
  let audioPath = null;
  let thumbPath = null;

  try {
    // Notify start
    await sendCallback(jobId, { status: 'downloading', progress: 1, sourceUrl: url });
    if (isYT || type === 'video') {
      // Always fetch full MP4 for YouTube
      try {
        videoPath = await downloadYouTubeAsMp4(url, baseDir, brokerHints);
      } catch (err) {
        const msg = err?.message || '';
        if (request.userId && COOKIE_FETCH_URL && COOKIE_FETCH_SECRET && looksLikeCookieExpiry(msg)) {
          console.warn('[INGEST] Detected cookie expiry/429; refreshing broker cookies and retrying once...');
          try {
            const refreshed = await fetchAndCacheCookies(request.userId, true);
            if (refreshed?.path) {
              JOB_COOKIES_OVERRIDE = refreshed.path;
              brokerHints.ua = refreshed.ua || brokerHints.ua;
              brokerHints.playerClient = refreshed.client || brokerHints.playerClient;
            }
            videoPath = await downloadYouTubeAsMp4(url, baseDir, brokerHints);
          } catch (e2) {
            throw e2;
          }
        } else {
          throw err;
        }
      }
      thumbPath = path.join(baseDir, 'thumb.jpg');
      await generateThumbnail(videoPath, thumbPath);
    } else if (type === 'audio') {
      try {
        audioPath = await downloadAudioAsMp3(url, baseDir, brokerHints);
      } catch (err) {
        const msg = err?.message || '';
        if (request.userId && COOKIE_FETCH_URL && COOKIE_FETCH_SECRET && looksLikeCookieExpiry(msg)) {
          console.warn('[INGEST] Detected cookie expiry/429 (audio); refreshing broker cookies and retrying once...');
          try {
            const refreshed = await fetchAndCacheCookies(request.userId, true);
            if (refreshed?.path) {
              JOB_COOKIES_OVERRIDE = refreshed.path;
              brokerHints.ua = refreshed.ua || brokerHints.ua;
              brokerHints.playerClient = refreshed.client || brokerHints.playerClient;
            }
            audioPath = await downloadAudioAsMp3(url, baseDir, brokerHints);
          } catch (e2) {
            throw e2;
          }
        } else {
          throw err;
        }
      }
    } else {
      // Fallback: attempt best video to mp4
      videoPath = await downloadYouTubeAsMp4(url, baseDir, brokerHints);
      thumbPath = path.join(baseDir, 'thumb.jpg');
      await generateThumbnail(videoPath, thumbPath);
    }

    // Uploads
    const uploads = {};
    if (videoPath) {
      const dest = `ingest/${jobId}/video.mp4`;
      uploads.videoUrl = await uploadFileToFirebase(videoPath, dest);
    }
    if (audioPath) {
      const dest = `ingest/${jobId}/audio.mp3`;
      uploads.audioUrl = await uploadFileToFirebase(audioPath, dest);
    }
    if (thumbPath) {
      const dest = `ingest/${jobId}/thumb.jpg`;
      uploads.thumbnailUrl = await uploadFileToFirebase(thumbPath, dest);
    }

    console.log('[INGEST] Uploaded assets:', uploads);

    // Final success callback
    await sendCallback(jobId, {
      status: 'completed',
      progress: 100,
      userId: request.userId || process.env.INGEST_DEFAULT_USER_ID || null,
      title: meta?.title || 'New Ingest',
      sourceUrl: url,
      videoUrl: uploads.videoUrl || null,
      audioUrl: uploads.audioUrl || null,
      thumbnailUrl: uploads.thumbnailUrl || null,
      mediaUrl: uploads.videoUrl || uploads.audioUrl || null,
      meta: {
        platform: isYT ? 'youtube' : (type || 'other'),
        durationSec: meta?.duration || meta?.duration_string || null,
      },
    });

    console.log('[INGEST] Job completed:', jobId);
  } catch (err) {
    console.error('[INGEST] Job failed:', jobId, err?.message);
    // Error callback so UI can show failure
    await sendCallback(jobId, { status: 'error', error: err?.message || 'ingest failed', progress: 0 });
  } finally {
    // Clean up per-request cookies temp file
    try {
      if (jobCookieTmp && fs.existsSync(jobCookieTmp)) fs.unlinkSync(jobCookieTmp);
    } catch {}
    JOB_COOKIES_OVERRIDE = null;
  }
}

// Simple shared-secret auth and rate limiting
const WORKER_SECRET = process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret';
// Enforce that each ingest job specifies the owner userId. Default: true
const REQUIRE_INGEST_USER_ID = String(process.env.REQUIRE_INGEST_USER_ID || 'true').toLowerCase() === 'true';
const rateBuckets = new Map();
const RATE_CAP = Number(process.env.INGEST_RATE_CAP || 30);

function takeToken(key) {
  const now = Date.now();
  const win = 60000;
  const state = rateBuckets.get(key) || { tokens: RATE_CAP, last: now };
  
  const elapsed = now - state.last;
  if (elapsed > 0) {
    const refill = Math.floor((elapsed / win) * RATE_CAP);
    state.tokens = Math.min(RATE_CAP, state.tokens + (refill > 0 ? refill : 0));
    state.last = now;
  }
  
  if (state.tokens <= 0) {
    rateBuckets.set(key, state);
    return false;
  }
  
  state.tokens -= 1;
  rateBuckets.set(key, state);
  return true;
}

// Update cookies cache for a user
app.post('/cookies/update', express.json({ limit: '5mb' }), async (req, res) => {
  if (!WORKER_SECRET) return res.status(503).json({ error: 'INGEST_WORKER_SECRET not configured' });
  const provided = (req.header('x-worker-secret') || '').trim();
  if (provided !== WORKER_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const key = `${provided}:${req.ip || req.socket.remoteAddress || 'unknown'}:cookiesUpdate`;
  if (!takeToken(key)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { userId, cookies_b64, cookies } = req.body || {};
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing userId' });
  let buf = null;
  if (typeof cookies_b64 === 'string' && cookies_b64.trim().length) {
    try { buf = Buffer.from(cookies_b64.trim(), 'base64'); } catch {}
  } else if (typeof cookies === 'string' && cookies.trim().length) {
    buf = Buffer.from(cookies, 'utf8');
  }
  if (!buf) return res.status(400).json({ error: 'Missing cookies_b64 or cookies' });

  const pathTmp = putCookiesForUser(userId, buf);
  return res.json({ ok: true, path: pathTmp, ttlSeconds: Math.floor(COOKIES_TTL_MS / 1000) });
});

// JSON parser for other routes (allow large cookies payloads)
app.use(express.json({ limit: '5mb' }));

// Ingest endpoint (POST) to support large cookies via JSON; id optional; userId cookie cache
app.post('/ingest', express.json({ limit: '5mb' }), async (req, res) => {
  if (!WORKER_SECRET) return res.status(503).json({ error: 'INGEST_WORKER_SECRET not configured' });
  const provided = (req.header('x-worker-secret') || '').trim();
  if (provided !== WORKER_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const key = `${provided}:${req.ip || req.socket.remoteAddress || 'unknown'}:ingest`;
  if (!takeToken(key)) return res.status(429).json({ error: 'Rate limit exceeded' });

  try {
    const body = req.body || {};
    let url = body.url;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' });
    try { url = decodeURIComponent(url); } catch {}
    const id = body.id || `job-${Date.now()}`;
    const allowedTypes = ['youtube', 'x', 'facebook', 'reddit', 'tiktok'];
    const rawType = body.type || 'youtube';
    const type = allowedTypes.includes(rawType) ? rawType : 'youtube';

    // If no cookies provided directly, but userId is present, attach cached cookies
    let cookies_b64 = typeof body.cookies_b64 === 'string' ? body.cookies_b64 : undefined;
    let cookies = typeof body.cookies === 'string' ? body.cookies : undefined;
    if (!cookies_b64 && !cookies && body.userId) {
      // Try cached first
      let cachedPath = getCachedCookiesForUser(body.userId);
      if (!cachedPath && COOKIE_FETCH_URL && COOKIE_FETCH_SECRET) {
        try {
          const fetched = await fetchAndCacheCookies(body.userId);
          cachedPath = fetched?.path;
        } catch (e) {
          console.warn('[INGEST] broker fetch during /ingest failed:', e?.message);
        }
      }
      if (cachedPath) {
        try {
          const data = fs.readFileSync(cachedPath);
          cookies_b64 = Buffer.from(data).toString('base64');
        } catch {}
      }
    }

    const reqBody = { id, url, type, cookies_b64, cookies };
    console.log('Ingest POST received', { id, url, type, hasCookiesB64: !!cookies_b64, hasCookies: !!cookies, userId: body.userId || null });
    runIngest(reqBody).catch((e) => {
      console.error('Failed to start ingest (POST)', { id, error: e?.message });
    });
    return res.status(202).json({ accepted: true, jobId: id });
  } catch (err) {
    return res.status(500).json({ accepted: false, error: String(err?.message || err) });
  }
});

// Test endpoint
app.get('/ingest/test', async (req, res) => {
  let url = req.query.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  try { url = decodeURIComponent(url); } catch {}
  const id = req.query.id || `job-${Date.now()}`;
  const allowedTypes = ['youtube', 'x', 'facebook', 'reddit', 'tiktok'];
  const rawType = req.query.type || 'youtube';
  const type = allowedTypes.includes(rawType) ? rawType : 'youtube';
  const reqBody = {
    id,
    url,
    type,
    cookies_b64: req.query.cookies_b64 || undefined,
    cookies: req.query.cookies || undefined,
  };
  console.log('Ingest test request received', reqBody);
  try {
    const result = await runIngest(reqBody);
    res.json({ accepted: true, jobId: id, result });
  } catch (err) {
    res.status(500).json({ accepted: false, error: String(err?.message || err) });
  }
});

// Cleanup endpoint for disk space management
app.post('/cleanup', async (req, res) => {
  try {
    console.log('[CLEANUP] Starting disk cleanup...');
    let cleaned = 0;
    let freed_mb = 0;
    const errors = [];

    // Clean temp directories
    const temp_dirs = ['/tmp', '/var/tmp', os.tmpdir()];
    for (const temp_dir of temp_dirs) {
      if (fs.existsSync(temp_dir)) {
        try {
          const items = fs.readdirSync(temp_dir);
          for (const item of items) {
            const item_path = path.join(temp_dir, item);
            try {
              const stat = fs.statSync(item_path);
              if (stat.isFile()) {
                const size = stat.size;
                fs.unlinkSync(item_path);
                cleaned++;
                freed_mb += size / (1024 * 1024);
              } else if (stat.isDirectory() && (item.startsWith('ghibli-') || item.startsWith('generated_') || item.startsWith('tmp_'))) {
                // Calculate directory size before deletion
                let dir_size = 0;
                try {
                  const walkDir = (dir) => {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                      const file_path = path.join(dir, file);
                      const file_stat = fs.statSync(file_path);
                      if (file_stat.isFile()) {
                        dir_size += file_stat.size;
                      } else if (file_stat.isDirectory()) {
                        walkDir(file_path);
                      }
                    }
                  };
                  walkDir(item_path);
                  freed_mb += dir_size / (1024 * 1024);
                } catch (e) {
                  // Ignore size calculation errors
                }
                fs.rmSync(item_path, { recursive: true, force: true });
                cleaned++;
              }
            } catch (e) {
              errors.push(`Failed to clean ${item_path}: ${e.message}`);
            }
          }
        } catch (e) {
          errors.push(`Failed to read ${temp_dir}: ${e.message}`);
        }
      }
    }

    // Clean old generated images (keep only last 10)
    const output_dir = path.join(process.cwd(), 'outputs');
    if (fs.existsSync(output_dir)) {
      try {
        const files = fs.readdirSync(output_dir);
        const image_files = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
        if (image_files.length > 10) {
          // Sort by modification time, keep newest 10
          const files_with_stats = image_files.map(f => ({
            name: f,
            path: path.join(output_dir, f),
            mtime: fs.statSync(path.join(output_dir, f)).mtime
          }));
          files_with_stats.sort((a, b) => b.mtime - a.mtime);
          
          for (const old_file of files_with_stats.slice(10)) {
            try {
              const size = fs.statSync(old_file.path).size;
              fs.unlinkSync(old_file.path);
              cleaned++;
              freed_mb += size / (1024 * 1024);
            } catch (e) {
              errors.push(`Failed to clean ${old_file.path}: ${e.message}`);
            }
          }
        }
      } catch (e) {
        errors.push(`Failed to clean outputs directory: ${e.message}`);
      }
    }

    console.log(`[CLEANUP] Completed: ${cleaned} items cleaned, ${freed_mb.toFixed(1)}MB freed`);
    
    res.json({
      ok: true,
      message: `Cleaned ${cleaned} items, freed ${freed_mb.toFixed(1)}MB`,
      details: {
        cleaned_files: cleaned,
        freed_space_mb: freed_mb,
        errors: errors
      }
    });
  } catch (err) {
    console.error('[CLEANUP] Error:', err);
    res.status(500).json({
      ok: false,
      message: `Cleanup failed: ${err.message}`
    });
  }
});

// Start server with runtime tool installation
async function startServer() {
  // Install video tools at startup
  await installVideoTools();
  console.log('[STARTUP] Broker config', {
    hasCookieFetchUrl: Boolean(COOKIE_FETCH_URL),
    hasCookieFetchSecret: Boolean(COOKIE_FETCH_SECRET)
  });
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Server listening on 0.0.0.0:${PORT}`);
    console.log(`[HTTP] Health check available at http://0.0.0.0:${PORT}/healthz`);
    const address = server.address();
    console.log('[HTTP] Server bound to:', address);
  });

  server.on('error', (err) => {
    console.error('[HTTP] Server error:', err?.stack || err);
    process.exit(1);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('[STARTUP] Failed to start server:', error);
  process.exit(1);
});

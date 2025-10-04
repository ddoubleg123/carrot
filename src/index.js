const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

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
    // Try installing yt-dlp. Prefer pip when available; otherwise fall back to direct download.
    console.log('[STARTUP] Installing yt-dlp...');
    try {
      await pExecFile('pip', ['install', '--user', '--upgrade', 'yt-dlp']);
      console.log('[STARTUP] yt-dlp installed successfully via pip');
    } catch (pipError) {
      console.log(`[STARTUP] pip not available or failed (${pipError?.message}); attempting direct download...`);
      try {
        await pExecFile('curl', ['-L', 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', '-o', '/usr/local/bin/yt-dlp']);
        await pExecFile('chmod', ['a+rx', '/usr/local/bin/yt-dlp']);
        console.log('[STARTUP] yt-dlp installed successfully via direct download');
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

      // Auth between worker -> app
      INGEST_WORKER_SECRET: process.env.INGEST_WORKER_SECRET ? 'SET' : 'MISSING',
      INGEST_CALLBACK_URL: process.env.INGEST_CALLBACK_URL ? 'SET' : 'MISSING',

      // Firebase Storage config (preferred)
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ? 'SET' : 'MISSING',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET' : 'MISSING',
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING',

      // Consolidated boolean for creds presence (supports Firebase_* and legacy aliases)
      HAS_FIREBASE_CREDS: Boolean(
        (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
        (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||     // still supported if present
        process.env.GOOGLE_APPLICATION_CREDENTIALS             // still supported if present
      ),
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
    process.env.GOOGLE_APPLICATION_CREDENTIALS || // file path style
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) // legacy alias supported
  ),
  PORT: process.env.PORT || 8080,
  YT_DLP_PATH: process.env.YT_DLP_PATH,
  YT_DLP_COOKIES: process.env.YT_DLP_COOKIES,
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

async function run(cmd, args, opts = {}) {
  const pExecFile = promisify(execFile);
  const res = await pExecFile(cmd, args, { maxBuffer: 1024 * 1024 * 50, ...opts });
  return res;
}

// Prepare yt-dlp cookies arguments based on environment variables
// Supports:
// - YT_DLP_COOKIES_FROM_BROWSER: e.g., 'chrome', 'edge' (works only when browser data is accessible)
// - YT_DLP_COOKIES: either
//     a) path to a Netscape cookies.txt on disk,
//     b) full cookies.txt content (inline), or
//     c) http(s) URL to a cookies.txt file (downloaded at runtime)
let CACHED_COOKIES_PATH = null;
async function getCookiesArgs() {
  try {
    const fromBrowser = (process.env.YT_DLP_COOKIES_FROM_BROWSER || '').trim();
    if (fromBrowser) {
      const profile = (process.env.YT_DLP_COOKIES_FROM_BROWSER_PROFILE || '').trim();
      const browserArg = profile ? `${fromBrowser}:${profile}` : fromBrowser;
      return ['--cookies-from-browser', browserArg];
    }

    const raw = process.env.YT_DLP_COOKIES;
    if (!raw) return [];

    // If it's clearly a path and exists, use it directly
    if ((raw.includes('/') || raw.includes('\\') || raw.endsWith('.txt')) && fs.existsSync(raw)) {
      return ['--cookies', raw];
    }

    // If it's a URL, download it to a temp file
    if (/^https?:\/\//i.test(raw)) {
      if (!CACHED_COOKIES_PATH) {
        const tmpPath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
        const resp = await fetch(raw);
        if (!resp.ok) throw new Error(`Failed to download cookies (${resp.status})`);
        const text = await resp.text();
        await fs.promises.writeFile(tmpPath, text, 'utf8');
        CACHED_COOKIES_PATH = tmpPath;
      }
      return ['--cookies', CACHED_COOKIES_PATH];
    }

    // Otherwise treat as inline cookies content
    if (!CACHED_COOKIES_PATH) {
      const tmpPath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      await fs.promises.writeFile(tmpPath, raw, 'utf8');
      CACHED_COOKIES_PATH = tmpPath;
    }
    return ['--cookies', CACHED_COOKIES_PATH];
  } catch (e) {
    console.warn('[INGEST] Failed to prepare cookies for yt-dlp:', e.message);
    return [];
  }
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

async function uploadFileToFirebase(localPath, destPath) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('FIREBASE_STORAGE_BUCKET not set');

  const Storage = tryRequireStorage();
  if (!Storage) throw new Error('Missing @google-cloud/storage');

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const storage = new Storage(
    credsJson ? { credentials: JSON.parse(credsJson) } : undefined
  );
  const bucket = storage.bucket(bucketName);
  await bucket.upload(localPath, { destination: destPath, resumable: false, contentType: undefined });
  const file = bucket.file(destPath);
  // Try to make public; if not allowed, fall back to signed URL
  try {
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodeURI(destPath)}`;
    return publicUrl;
  } catch {
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    return signedUrl;
  }
}

async function generateThumbnail(inputVideoPath, outputThumbPath) {
  // Capture a frame at ~2s
  await run('ffmpeg', ['-y', '-ss', '2', '-i', inputVideoPath, '-frames:v', '1', '-q:v', '2', outputThumbPath]);
}

async function downloadYouTubeAsMp4(url, outDir) {
  const outTemplate = path.join(outDir, 'video.%(ext)s');
  // Prefer mp4. If not available, merge best and force mp4 container
  const args = [
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '--merge-output-format', 'mp4',
    '-o', outTemplate,
    url
  ];
  const cookieArgs = await getCookiesArgs();
  const finalArgs = cookieArgs.length ? [...args.slice(0, -1), ...cookieArgs, url] : args;
  await run('yt-dlp', finalArgs);
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

async function downloadAudioAsMp3(url, outDir) {
  const outTemplate = path.join(outDir, 'audio.%(ext)s');
  const args = ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', outTemplate, url];
  const cookieArgs = await getCookiesArgs();
  const finalArgs = cookieArgs.length ? [...args.slice(0, -1), ...cookieArgs, url] : args;
  await run('yt-dlp', finalArgs);
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

async function fetchYtMetadata(url) {
  try {
    const cookieArgs = await getCookiesArgs();
    const args = ['-J'];
    const finalArgs = cookieArgs.length ? [...args, ...cookieArgs, url] : [...args, url];
    const { stdout } = await run('yt-dlp', finalArgs);
    return JSON.parse(stdout);
  } catch (e) {
    console.warn('[INGEST] Failed to fetch yt-dlp metadata:', e.message);
    return null;
  }
}

// Placeholder ingest function
async function runIngest(request) {
  console.log('[INGEST] Starting job:', request.id);
  console.log('[INGEST] URL:', request.url);
  console.log('[INGEST] Type:', request.type);
  const jobId = request.id;
  const url = request.url;
  const type = request.type;

  const baseDir = path.join(os.tmpdir(), 'jobs', jobId);
  await ensureDir(baseDir);

  const isYT = isYouTube(url, type);
  const meta = isYT ? await fetchYtMetadata(url) : null;

  let videoPath = null;
  let audioPath = null;
  let thumbPath = null;

  try {
    if (isYT || type === 'video') {
      // Always fetch full MP4 for YouTube
      videoPath = await downloadYouTubeAsMp4(url, baseDir);
      thumbPath = path.join(baseDir, 'thumb.jpg');
      await generateThumbnail(videoPath, thumbPath);
    } else if (type === 'audio') {
      audioPath = await downloadAudioAsMp3(url, baseDir);
    } else {
      // Fallback: attempt best video to mp4
      videoPath = await downloadYouTubeAsMp4(url, baseDir);
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

    // Optional callback to Carrot app
    if (process.env.INGEST_CALLBACK_URL) {
      try {
        const payload = {
          userId: request.userId || process.env.INGEST_DEFAULT_USER_ID || null,
          content: (meta?.title) || 'New Ingest',
          videoUrl: uploads.videoUrl || null,
          audioUrl: uploads.audioUrl || null,
          thumbnailUrl: uploads.thumbnailUrl || null,
          sourceUrl: url,
          meta: {
            platform: isYT ? 'youtube' : (type || 'other'),
            durationSec: meta?.duration || meta?.duration_string || null,
          },
        };
        await fetch(process.env.INGEST_CALLBACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret',
          },
          body: JSON.stringify(payload),
        }).then(async (r) => {
          const text = await r.text();
          console.log('[INGEST] Callback response', r.status, text);
        }).catch((e) => {
          console.error('[INGEST] Callback failed:', e.message);
        });
      } catch (e) {
        console.error('[INGEST] Callback error:', e.message);
      }
    } else {
      console.log('[INGEST] No INGEST_CALLBACK_URL set; skipping callback');
    }

    console.log('[INGEST] Job completed:', jobId);
  } catch (err) {
    console.error('[INGEST] Job failed:', jobId, err?.message);
  } finally {
    // Best-effort cleanup can be added if needed
  }
}

// Simple shared-secret auth and rate limiting
const WORKER_SECRET = process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret';
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

// Ingest endpoint
app.post('/ingest', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!WORKER_SECRET) {
    return res.status(503).json({ error: 'INGEST_WORKER_SECRET not configured' });
  }
  
  const provided = (req.header('x-worker-secret') || '').trim();
  if (provided !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const key = `${provided}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  if (!takeToken(key)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  let body = req.body;
  if (typeof body === 'string') {
    let text = body;
    if (text.startsWith('%JSON%')) {
      text = text.replace(/^%JSON%\r?\n?/, '');
    }
    try {
      body = JSON.parse(text);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  
  if (!body?.id || !body?.url || !body?.type) {
    return res.status(400).json({ error: 'Missing id, url, or type' });
  }
  
  console.log('Ingest request received', { id: body.id, type: body.type, url: body.url });
  runIngest(body).catch((e) => {
    console.error('Failed to start ingest', { id: body.id, error: e?.message });
  });
  
  return res.status(202).json({ accepted: true, jobId: body.id });
});

// Test endpoint
app.get('/ingest/test', async (req, res) => {
  const url = req.query.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const id = req.query.id || `job-${Date.now()}`;
  const allowedTypes = ['youtube', 'x', 'facebook', 'reddit', 'tiktok'];
  const rawType = req.query.type || 'youtube';
  const type = allowedTypes.includes(rawType) ? rawType : 'youtube';
  
  console.log('Ingest test request received', { id, url, type });
  runIngest({ id, url, type }).catch((e) => {
    console.error('Failed to start ingest (test)', { id, error: e?.message });
  });
  
  return res.status(202).json({ accepted: true, jobId: id });
});

// JSON parser for other routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Start server with runtime tool installation
async function startServer() {
  // Install video tools at startup
  await installVideoTools();
  
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

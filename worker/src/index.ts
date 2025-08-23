import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { runIngest, IngestRequest, runTrim, TrimRequest } from './ingest.js';

const app = express();

// Minimal request logger to observe health probes and other requests
app.use((req, _res, next) => {
  try {
    console.log('REQ', { method: req.method, url: req.url, ip: req.ip || req.socket.remoteAddress });
  } catch {}
  next();
});

// Directory to serve completed media when no bucket is configured
const DATA_DIR = path.resolve(process.cwd(), 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'ingest');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Startup guard and cookie auto-detection
// 1) Auto-detect cookies.txt from Downloads to set YT_DLP_COOKIES if not provided
try {
  const userProfile = process.env.USERPROFILE || process.env.HOME;
  if (!process.env.YT_DLP_COOKIES && userProfile) {
    const dlCookies = path.join(userProfile, 'Downloads', 'yt-cookies.txt');
    if (fs.existsSync(dlCookies)) {
      process.env.YT_DLP_COOKIES = dlCookies;
      console.log('Startup: using cookies file from Downloads', { YT_DLP_COOKIES: dlCookies });
    }
  }
} catch {}
// 1b) If a cookies file is configured and exists, force preference to file cookies
try {
  const cookiesPath = process.env.YT_DLP_COOKIES;
  if (cookiesPath && fs.existsSync(cookiesPath)) {
    if (process.env.YT_DLP_COOKIES_FROM_BROWSER) {
      delete process.env.YT_DLP_COOKIES_FROM_BROWSER;
      console.log('Startup: preferring file cookies; cleared YT_DLP_COOKIES_FROM_BROWSER');
    }
  }
} catch {}
// 2) Enforce YT_DLP_PATH presence so rogue instances without env cannot bind :8080
if (!process.env.YT_DLP_PATH) {
  console.warn('STARTUP_GUARD: YT_DLP_PATH is not set. Continuing to start server so health checks work; ingest will fail without it.');
}

// Lightweight CORS for media so the browser can use it for previews/thumbnails
app.use('/media', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.use('/media', express.static(DATA_DIR));

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// Accept root as a health alias to satisfy default probes
app.get('/', (_req, res) => {
  res.status(200).send('ok');
});

// Aliases for health checks
app.get('/livez', (_req, res) => {
  res.status(200).send('ok');
});
app.get('/readyz', (_req, res) => {
  res.status(200).send('ok');
});

// Debug: list registered routes
app.get('/routes', (_req, res) => {
  const routes: Array<{ path: string; methods: string[] }> = [];
  // @ts-ignore accessing private Express internals for debugging only
  app._router?.stack?.forEach((m: any) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods || {}).filter(Boolean);
      routes.push({ path: m.route.path, methods });
    } else if (m.name === 'router' && m.handle?.stack) {
      m.handle.stack.forEach((h: any) => {
        if (h.route && h.route.path) {
          const methods = Object.keys(h.route.methods || {}).filter(Boolean);
          routes.push({ path: h.route.path, methods });
        }
      });
    }
  });
  res.json({ routes });
});

const pExecFile = promisify(execFile);
app.get('/debug', async (_req, res) => {
  const tools: Record<string, unknown> = {};
  const result: Record<string, unknown> = {
    env: {
      INGEST_CALLBACK_URL: process.env.INGEST_CALLBACK_URL,
      WORKER_PUBLIC_URL: process.env.WORKER_PUBLIC_URL,
      HAS_CALLBACK_SECRET: Boolean(process.env.INGEST_CALLBACK_SECRET),
      GCS_BUCKET: process.env.GCS_BUCKET,
      HAS_GOOGLE_APPLICATION_CREDENTIALS: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      PORT: process.env.PORT || 8080,
      YT_DLP_PATH: process.env.YT_DLP_PATH,
      YT_DLP_COOKIES: process.env.YT_DLP_COOKIES,
      YT_DLP_COOKIES_FROM_BROWSER: process.env.YT_DLP_COOKIES_FROM_BROWSER,
      INGEST_TRIM_SECONDS: process.env.INGEST_TRIM_SECONDS,
    },
    tools,
  };
  try {
    const { stdout } = await pExecFile('ffmpeg', ['-version']);
    tools.ffmpeg = stdout.split('\n')[0];
  } catch (e: any) {
    tools.ffmpeg = `NOT FOUND: ${e?.message || e}`;
  }
  // Try multiple yt-dlp candidates similar to ingest logic
  const ytCandidates = [
    process.env.YT_DLP_PATH,
    'yt-dlp',
    process.platform === 'win32' ? 'yt-dlp.exe' : undefined,
    process.platform === 'win32' ? 'C\\\\Tools\\\\yt-dlp\\\\yt-dlp.exe' : undefined,
  ].filter(Boolean) as string[];
  let ytErr: any;
  for (const bin of ytCandidates) {
    try {
      const { stdout } = await pExecFile(bin, ['--version']);
      tools.yt_dlp = stdout.trim();
      ytErr = undefined;
      break;
    } catch (e: any) {
      ytErr = e;
    }
  }
  if (ytErr) {
    tools.yt_dlp = `NOT FOUND: ${ytErr?.message || ytErr}`;
  }
  // Bundled binaries info
  tools.ffmpeg_static_path = 'NOT_INSTALLED';
  // We no longer depend on yt-dlp-exec; rely on system yt-dlp if present
  res.status(200).json(result);
});

// Simple shared-secret auth and naive rate limit for ingest endpoint
// Default to 'dev_ingest_secret' in local dev to avoid 503 when env is missing
const WORKER_SECRET = process.env.INGEST_WORKER_SECRET || 'dev_ingest_secret';
type RLKey = string;
const rateBuckets: Map<RLKey, { tokens: number; last: number }> = new Map();
const RATE_CAP = Number(process.env.INGEST_RATE_CAP || 30); // requests per 60s per key
function takeToken(key: RLKey) {
  const now = Date.now();
  const win = 60_000;
  const state = rateBuckets.get(key) || { tokens: RATE_CAP, last: now };
  // refill
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

// Robust ingest endpoint with raw text parsing to tolerate RSC "%JSON%" prefix
app.post('/ingest', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  // Auth
  if (!WORKER_SECRET) {
    return res.status(503).json({ error: 'INGEST_WORKER_SECRET not configured' });
  }
  const provided = (req.header('x-worker-secret') || '').trim();
  if (provided !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Rate limit per secret + IP
  const key = `${provided}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  if (!takeToken(key)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  // Parse body safely, stripping any RSC prefix if present
  let body: any = req.body;
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
  // Kick off ingestion asynchronously
  console.log('Ingest request received', { id: body.id, type: body.type, url: body.url });
  runIngest(body as IngestRequest).catch((e) => {
    console.error('Failed to start ingest', { id: body.id, error: e?.message });
  });
  return res.status(202).json({ accepted: true, jobId: body.id });
});

// Background trim endpoint
app.post('/trim', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!WORKER_SECRET) {
    return res.status(503).json({ error: 'INGEST_WORKER_SECRET not configured' });
  }
  const provided = (req.header('x-worker-secret') || '').trim();
  if (provided !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const key = `${provided}:${req.ip || req.socket.remoteAddress || 'unknown'}:trim`;
  if (!takeToken(key)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  let body: any = req.body;
  if (typeof body === 'string') {
    let text = body;
    if (text.startsWith('%JSON%')) {
      text = text.replace(/^%JSON%\r?\n?/, '');
    }
    try { body = JSON.parse(text); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  if (!body?.id || !body?.sourceUrl) {
    return res.status(400).json({ error: 'Missing id or sourceUrl' });
  }
  console.log('Trim request received', { id: body.id, startSec: body.startSec, endSec: body.endSec });
  runTrim(body as TrimRequest).catch((e) => {
    console.error('Failed to start trim', { id: body.id, error: e?.message });
  });
  return res.status(202).json({ accepted: true, jobId: body.id });
});

// After defining /ingest, install generic parsers for other routes
app.use(express.json({ limit: '1mb' }));
// Also accept application/x-www-form-urlencoded for easier CLI testing
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Simple test endpoint to trigger ingest without JSON body
// Usage: GET /ingest/test?url=<video_url>&id=<optional_id>&type=youtube
app.get('/ingest/test', async (req, res) => {
  const url = (req.query.url as string) || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const id = (req.query.id as string) || `job-${Date.now()}`;
  const allowedTypes = ['youtube', 'x', 'facebook', 'reddit', 'tiktok'] as const;
  const rawType = (req.query.type as string) || 'youtube';
  const type = (allowedTypes as readonly string[]).includes(rawType)
    ? (rawType as typeof allowedTypes[number])
    : 'youtube';
  console.log('Ingest test request received', { id, url, type });
  runIngest({ id, url, type }).catch((e) => {
    console.error('Failed to start ingest (test)', { id, error: e?.message });
  });
  return res.status(202).json({ accepted: true, jobId: id });
});

// Basic process error logging for easier troubleshooting
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT_EXCEPTION', err?.stack || err);
});
process.on('unhandledRejection', (reason: unknown) => {
  console.error('UNHANDLED_REJECTION', reason);
});

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Ingest worker listening on :${port}`);
  console.log('Env summary', {
    HOST: host,
    WORKER_PUBLIC_URL: process.env.WORKER_PUBLIC_URL,
    INGEST_CALLBACK_URL: process.env.INGEST_CALLBACK_URL,
    HAS_CALLBACK_SECRET: Boolean(process.env.INGEST_CALLBACK_SECRET),
    GCS_BUCKET: process.env.GCS_BUCKET,
    HAS_GOOGLE_APPLICATION_CREDENTIALS: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    YT_DLP_PATH: process.env.YT_DLP_PATH,
  });
  // Log cookie mode for clarity
  if (process.env.YT_DLP_COOKIES) {
    console.log('Cookie mode: file', { YT_DLP_COOKIES: process.env.YT_DLP_COOKIES });
  } else if (process.env.YT_DLP_COOKIES_FROM_BROWSER) {
    console.log('Cookie mode: from-browser', { YT_DLP_COOKIES_FROM_BROWSER: process.env.YT_DLP_COOKIES_FROM_BROWSER });
  } else {
    console.log('Cookie mode: none');
  }
});
server.on('listening', () => {
  try {
    const addr = server.address();
    console.log('Server bound address', addr);
  } catch (e) {
    console.log('Server bound address (unavailable)');
  }
});
server.on('error', (err) => {
  console.error('SERVER_LISTEN_ERROR', err?.stack || err);
});

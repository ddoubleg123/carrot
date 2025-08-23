import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

const cwd = resolve(process.cwd(), 'worker');
const outPath = resolve(process.cwd(), 'worker_8080_out.txt');
const errPath = resolve(process.cwd(), 'worker_8080_err.txt');
const pidPath = resolve(process.cwd(), 'pid_8080.txt');

const out = createWriteStream(outPath, { flags: 'a' });
const err = createWriteStream(errPath, { flags: 'a' });

const env = {
  ...process.env,
  PORT: '8080',
  INGEST_WORKER_SECRET: 'dev_ingest_secret',
  INGEST_CALLBACK_URL: 'http://localhost:3005/api/ingest/callback',
  // Pass the callback secret so the worker includes it on callback requests
  // This must match the app's INGEST_CALLBACK_SECRET in .env.local
  INGEST_CALLBACK_SECRET: process.env.INGEST_CALLBACK_SECRET || 'dev_ingest_secret',
  WORKER_PUBLIC_URL: 'http://127.0.0.1:8080',
  // Ensure yt-dlp path is available by default on this machine
  YT_DLP_PATH: process.env.YT_DLP_PATH || (process.platform === 'win32' ? 'C:\\Tools\\yt-dlp\\yt-dlp.exe' : 'yt-dlp'),
  // Force-disable Cloudflare Stream upload unless explicitly enabled here.
  // This prevents dynamic import of 'tus-js-client' in dev when CF env vars
  // are present globally on the machine.
  CLOUDFLARE_API_TOKEN: '',
  CLOUDFLARE_ACCOUNT_ID: '',
};

// Guard: if pid file exists and process is alive, do not start another
try {
  const prev = require('node:fs').readFileSync(pidPath, 'utf8').trim();
  const prevPid = Number(prev);
  if (prevPid && Number.isFinite(prevPid)) {
    try {
      process.kill(prevPid, 0); // test if process exists
      console.log(`Worker already running (PID ${prevPid}). Not starting another.`);
      console.log('Logs:', outPath, errPath);
      process.exit(0);
    } catch {}
  }
} catch {}

const child = spawn(process.platform === 'win32' ? 'node.exe' : 'node', ['dist/index.js'], {
  cwd,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});

child.stdout.pipe(out);
child.stderr.pipe(err);

// Write PID file
try { require('node:fs').writeFileSync(pidPath, String(child.pid)); } catch {}

child.unref();

console.log('Started ingest worker (detached). PID:', child.pid);
console.log('Logs:', outPath, errPath);

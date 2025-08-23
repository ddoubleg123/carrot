import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function loadEnvFile(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

// Load envs: local root, carrot local, carrot .env
const ROOT = path.resolve(__dirname, '..', '..');
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

// Late import after env available (use CommonJS require for firebase-admin)
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!privateKey || !clientEmail || !projectId || !bucketName) {
  console.error('Missing Firebase Admin envs');
  process.exit(1);
}

let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: bucketName,
  });
} else {
  app = admin.app();
}

async function main() {
  const bucket = admin.storage(app).bucket(bucketName);
  let files = [];
  try {
    const [list] = await bucket.getFiles({ maxResults: 50 });
    files = list;
  } catch (e) {
    const outErr = { ok: false, bucket: bucketName, error: String(e) };
    const outPathErr = path.join(process.cwd(), 'debug_storage.json');
    fs.writeFileSync(outPathErr, JSON.stringify(outErr, null, 2));
    console.log('Wrote', outPathErr);
    return;
  }

  const items = files.map((f) => ({
    name: f.name,
    size: f.metadata?.size,
    contentType: f.metadata?.contentType,
    updated: f.metadata?.updated,
  }));
  const out = { ok: true, bucket: bucketName, count: items.length, items };
  const outPath = path.join(process.cwd(), 'debug_storage.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Wrote', outPath);
}

main().catch((e) => {
  console.error('Storage list error:', e);
  process.exit(1);
});

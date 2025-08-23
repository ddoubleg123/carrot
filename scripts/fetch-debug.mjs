import fs from 'node:fs';
import path from 'node:path';

const argBase = process.argv[2];
const BASE = argBase || process.env.DEBUG_BASE_URL || 'http://localhost:3005';

async function fetchJson(url, timeoutMs = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
    const text = await res.text();
    try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, text }; }
  } catch (e) {
    return { error: String(e), url };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const endpoints = [
    '/api/debug/db',
    '/api/debug/storage?max=10',
    '/api/posts'
  ];
  const out = { base: BASE, startedAt };
  for (const ep of endpoints) {
    const url = BASE + ep;
    const res = await fetchJson(url);
    out[ep] = res;
  }
  const outPath = path.join(process.cwd(), 'debug_3005.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Wrote', outPath);
}

main();

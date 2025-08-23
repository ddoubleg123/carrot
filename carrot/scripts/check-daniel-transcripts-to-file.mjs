// Usage: node scripts/check-daniel-transcripts-to-file.mjs
import fs from 'fs/promises';

const BASE = process.env.BASE_URL || 'http://localhost:3005';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 7000);
const OUT = process.env.OUT || './transcripts-check.json';

async function main() {
  const out = { ok: true, error: null, items: [] };
  try {
    // Fetch with timeout to avoid hanging when server isn't running
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE}/api/posts`, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`GET /api/posts -> ${res.status}`);
    const posts = await res.json();
    const filtered = posts
      .filter(p => (p?.User?.username === 'daniel' || p?.User?.name === 'daniel' || (p?.User?.email || '').startsWith('daniel')) && (p.videoUrl || p.audioUrl))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);

    for (const p of filtered) {
      try {
        const ac2 = new AbortController();
        const t2 = setTimeout(() => ac2.abort(), TIMEOUT_MS);
        const s = await fetch(`${BASE}/api/transcribe?postId=${p.id}`, { signal: ac2.signal });
        clearTimeout(t2);
        const j = await s.json().catch(() => ({}));
        out.items.push({
          id: p.id,
          createdAt: p.createdAt,
          hasVideo: !!p.videoUrl,
          hasAudio: !!p.audioUrl,
          transcriptionStatus: j.status,
          hasTranscription: !!j.transcription,
        });
      } catch (e) {
        out.items.push({ id: p.id, error: String(e) });
      }
    }
  } catch (e) {
    out.ok = false;
    out.error = e?.message || String(e);
  } finally {
    await fs.writeFile(OUT, JSON.stringify(out, null, 2));
  }
}

main();

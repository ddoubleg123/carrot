// Usage: node scripts/retrigger-daniel-transcripts.mjs
import fs from 'fs/promises';

const BASE = process.env.BASE_URL || 'http://localhost:3005';
const OUT = process.env.OUT || './retrigger-results.json';

async function main() {
  const out = { ok: true, items: [], error: null };
  try {
    const res = await fetch(`${BASE}/api/posts`);
    if (!res.ok) throw new Error(`GET /api/posts -> ${res.status}`);
    const posts = await res.json();

    const pick = posts
      .filter(p => (p?.User?.username === 'daniel' || p?.User?.name === 'daniel' || (p?.User?.email || '').startsWith('daniel')) && (p.videoUrl || p.audioUrl))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);

    for (const p of pick) {
      const body = {
        postId: p.id,
        mediaType: p.audioUrl ? 'audio' : 'video',
      };
      if (p.audioUrl) body.audioUrl = p.audioUrl;
      if (p.videoUrl) body.videoUrl = p.videoUrl;

      try {
        const tr = await fetch(`${BASE}/api/transcribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await tr.json().catch(() => ({}));
        out.items.push({ id: p.id, statusCode: tr.status, response: j });
      } catch (e) {
        out.items.push({ id: p.id, error: e?.message || String(e) });
      }
    }
  } catch (e) {
    out.ok = false;
    out.error = e?.message || String(e);
  } finally {
    await fs.writeFile(OUT, JSON.stringify(out, null, 2));
    console.log(`Wrote ${OUT}`);
  }
}

main();

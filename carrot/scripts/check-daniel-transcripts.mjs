// Usage: node scripts/check-daniel-transcripts.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3005';

async function main() {
  try {
    const res = await fetch(`${BASE}/api/posts`);
    if (!res.ok) {
      console.error('ERR_FETCH_POSTS', res.status);
      process.exit(0);
    }
    const posts = await res.json();
    const filtered = posts
      .filter(p => (p?.User?.username === 'daniel' || p?.User?.name === 'daniel' || (p?.User?.email || '').startsWith('daniel')) && (p.videoUrl || p.audioUrl))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 2);

    const results = [];
    for (const p of filtered) {
      try {
        const s = await fetch(`${BASE}/api/transcribe?postId=${p.id}`);
        const j = await s.json().catch(() => ({}));
        results.push({
          id: p.id,
          createdAt: p.createdAt,
          hasVideo: !!p.videoUrl,
          hasAudio: !!p.audioUrl,
          transcriptionStatus: j.status,
          hasTranscription: !!j.transcription,
        });
      } catch (e) {
        results.push({ id: p.id, error: String(e) });
      }
    }

    console.log(JSON.stringify({ count: posts?.length || 0, matches: results.length, items: results }, null, 2));
  } catch (e) {
    console.error('ERR', e?.message || e);
  }
}

main();

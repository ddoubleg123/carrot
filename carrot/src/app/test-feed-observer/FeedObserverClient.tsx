'use client';

import React from 'react';

type ServerPost = {
  id: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  imageUrls?: string[] | null;
  thumbnailUrl?: string | null;
};

export default function FeedObserverClient({ posts }: { posts: ServerPost[] }) {
  const [log, setLog] = React.useState<any[]>([]);
  const [mounted, setMounted] = React.useState(false);

  // Seed FeedMediaManager with the first N posts
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamically import to avoid SSR leaking
        const mod = await import('@/components/video/FeedMediaManager');
        const FMM: any = (mod as any).default || mod;
        if (!FMM) return;
        const mapped = (posts || []).slice(0, 20).map((p, idx) => {
          const hasVideo = !!p.videoUrl;
          const hasAudio = !!p.audioUrl && !hasVideo;
          const hasImages = Array.isArray(p.imageUrls) && p.imageUrls.length > 0;
          const type: 'video' | 'audio' | 'image' | 'text' = hasVideo ? 'video' : (hasAudio ? 'audio' : (hasImages ? 'image' : 'text'));
          const thumbnailUrl = p.thumbnailUrl || (hasImages ? p.imageUrls![0] : undefined);
          return { id: p.id, type, thumbnailUrl, videoUrl: p.videoUrl || undefined, feedIndex: idx } as any;
        });
        FMM.inst.setPosts(mapped);
        FMM.inst.setViewportIndex(0);
        setMounted(true);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [posts]);

  // Live tap of __mpq_log
  React.useEffect(() => {
    const w: any = window as any;
    if (!Array.isArray(w.__mpq_log)) w.__mpq_log = [];
    const initial = w.__mpq_log.slice();
    setLog(initial);
    const onEvt = (e: any) => {
      try {
        const entry = e?.detail; if (!entry) return;
        setLog((prev) => {
          const next = prev.concat(entry);
          return next.slice(-200);
        });
      } catch {}
    };
    w.addEventListener?.('mpq-enqueue', onEvt);
    const t = setInterval(() => {
      try {
        const buf = Array.isArray(w.__mpq_log) ? w.__mpq_log.slice(-200) : [];
        setLog(buf);
      } catch {}
    }, 800);
    return () => { clearInterval(t); w.removeEventListener?.('mpq-enqueue', onEvt); };
  }, []);

  const firstRows = React.useMemo(() => log.slice(-50).map((e) => ({
    ts: new Date(e.ts).toISOString().split('T')[1].slice(0, 12),
    idx: e.feedIndex,
    id: e.postId,
    type: e.type,
  })), [log]);

  return (
    <div>
      <div style={{ margin: '12px 0' }}>
        <strong>Status:</strong> {mounted ? 'Preloader mounted' : 'Mounting preloader...'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 360px 220px', gap: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>time</div>
        <div style={{ fontWeight: 700 }}>idx</div>
        <div style={{ fontWeight: 700 }}>postId</div>
        <div style={{ fontWeight: 700 }}>type</div>
        {firstRows.map((r, i) => (
          <React.Fragment key={i}>
            <div>{r.ts}</div>
            <div>{String(r.idx).padStart(2, '0')}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.id}</div>
            <div>{r.type}</div>
          </React.Fragment>
        ))}
      </div>
      <p style={{ marginTop: 12, color: '#666' }}>
        Expect to see POSTER and VIDEO_PREROLL_6S enqueues for indices 0..9 within ~1–1.5s after load.
      </p>
    </div>
  );
}

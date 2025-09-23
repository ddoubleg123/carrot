"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import FeedMediaManager, { type PostAsset as FMPostAsset } from "../../components/video/FeedMediaManager";
import MediaPreloadQueue, { TaskType, Priority } from "../../lib/MediaPreloadQueue";
import NeverBlackVideo from "../../components/video/NeverBlackVideo";

type PostDTO = {
  id: string;
  type: "video" | "image" | "text" | "audio" | string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrls?: string[] | null;
  bucket?: string | null;
  path?: string | null;
};

function mapPostsToAssets(posts: PostDTO[], limit: number): FMPostAsset[] {
  const slice = posts.slice(0, Math.max(1, limit));
  return slice.map((p, i) => {
    const isVideo = typeof p.videoUrl === 'string' && !!p.videoUrl;
    const isImage = !isVideo && Array.isArray(p.imageUrls) && p.imageUrls.length > 0;
    const kind: 'video' | 'image' | 'text' | 'audio' = isVideo ? 'video' : (isImage ? 'image' : 'text');
    return {
      id: p.id,
      type: kind,
      videoUrl: p.videoUrl || undefined,
      thumbnailUrl: p.thumbnailUrl || (isImage ? p.imageUrls?.[0] : undefined),
      bucket: p.bucket || undefined,
      path: p.path || undefined,
      feedIndex: i,
    } as FMPostAsset;
  });
}

function useMpqLog() {
  const [log, setLog] = useState<any[]>([]);
  useEffect(() => {
    const w: any = window as any;
    if (!Array.isArray(w.__mpq_log)) w.__mpq_log = [];
    const handler = (e: any) => {
      try {
        const entry = e?.detail || e;
        w.__mpq_log.push(entry);
        if (w.__mpq_log.length > 1000) w.__mpq_log.shift();
        setLog(w.__mpq_log.slice(-300));
      } catch {}
    };
    window.addEventListener('mpq-enqueue' as any, handler as any);
    // Prime state
    setLog(w.__mpq_log.slice(-300));
    return () => window.removeEventListener('mpq-enqueue' as any, handler as any);
  }, []);
  return log;
}

export default function LivePreloadClient({ limit = 20 }: { limit?: number }) {
  const [status, setStatus] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FMPostAsset[]>([]);
  const [viewportIndex, setViewportIndex] = useState(0);
  const mpqLog = useMpqLog();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        const resp = await fetch('/api/posts', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: PostDTO[] = await resp.json();
        let mapped = mapPostsToAssets(data, limit);
        // Fallback: if API returned zero posts, synthesize a small demo feed with videos
        if (!mapped || mapped.length === 0) {
          const demo: PostDTO[] = [
            { id: 'demo-vid-1', type: 'video', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
            { id: 'demo-vid-2', type: 'video', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
            { id: 'demo-vid-3', type: 'video', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4' },
          ];
          mapped = mapPostsToAssets(demo, Math.min(limit, demo.length));
          if (process.env.NODE_ENV !== 'production') {
            try { console.warn('[LivePreloadClient] /api/posts returned 0; using demo posts for test-preload'); } catch {}
          }
        }
        if (cancelled) return;
        setPosts(mapped);
        FeedMediaManager.inst.setPosts(mapped);
        setStatus('ready');
      } catch (e: any) {
        setError(String(e?.message || e));
        setStatus('error');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [limit]);

  useEffect(() => {
    const onScroll = () => {
      try {
        const cards = Array.from(document.querySelectorAll('[data-post-id]')) as HTMLElement[];
        const mid = window.scrollY + window.innerHeight / 2;
        let best = 0, bestDist = Infinity;
        cards.forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const center = r.top + window.scrollY + r.height / 2;
          const d = Math.abs(center - mid);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        setViewportIndex(best);
        FeedMediaManager.inst.setViewportIndex(best);
      } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const next10 = useMemo(() => {
    const start = viewportIndex + 1;
    const end = Math.min(start + 10, posts.length);
    return posts.slice(start, end).map(p => p.feedIndex);
  }, [viewportIndex, posts]);

  const recent = useMemo(() => mpqLog.slice(-120).reverse(), [mpqLog]);

  const perIndex = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const e of mpqLog) {
      const idx = typeof e.feedIndex === 'number' ? e.feedIndex : -1;
      if (idx < 0) continue;
      if (!map.has(idx)) map.set(idx, new Set());
      if (e.type) map.get(idx)!.add(String(e.type));
    }
    return map;
  }, [mpqLog]);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b p-3 text-sm">
        <div className="flex gap-4 flex-wrap items-center">
          <div><b>Viewport</b>: idx {viewportIndex} / {posts.length}</div>
          <div><b>Next10</b>: [{next10.join(', ')}]</div>
          <div className="hidden md:block"><b>Rule</b>: poster → 6s video, strict 1→10</div>
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px]">
          {Array.from({ length: Math.min(12, posts.length) }, (_, i) => i).map(i => {
            const types = perIndex.get(i);
            return (
              <div key={i} className="border rounded p-2">
                <div className="font-medium">#{String(i).padStart(2,'0')}</div>
                <div>{types ? Array.from(types).join(',') : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        <h2 className="text-sm font-semibold">Recent MPQ enqueues</h2>
        <pre className="text-[11px] bg-gray-50 p-2 rounded overflow-auto max-h-64">{JSON.stringify(recent, null, 2)}</pre>
      </div>

      {status === 'error' && (
        <div className="p-4 text-red-600">Error: {error}</div>
      )}

      {/* PUBLIC FEED LIST - renders actual videos without login */}
      <div className="p-4 space-y-8">
        {posts.map((p) => (
          <div key={p.id} data-post-id={p.id} className="max-w-2xl mx-auto border rounded-lg overflow-hidden shadow-sm">
            <div className="p-3 text-sm text-gray-600 flex items-center gap-2">
              <span className="inline-block w-6 h-6 rounded-full bg-gray-200" />
              <span className="font-medium">@user_{p.id.slice(0,4)}</span>
              <span className="text-gray-400">·</span>
              <span>#{String(p.feedIndex).padStart(2,'0')}</span>
            </div>
            {p.type === 'video' && p.videoUrl ? (
              <NeverBlackVideo
                postId={p.id}
                src={p.videoUrl}
                poster={p.thumbnailUrl}
                bucket={p.bucket}
                path={p.path}
                className="w-full"
                muted
                playsInline
                controls={false}
                autoPlay={false}
              />
            ) : p.type === 'image' && p.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnailUrl} alt="image" className="w-full object-cover" />
            ) : (
              <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-400">No media</div>
            )}
            <div className="p-3 text-xs text-gray-500">
              <button
                className="px-2 py-1 border rounded mr-2"
                onClick={() => FeedMediaManager.inst.setActive(FeedMediaManager.inst.getHandleByElement(document.querySelector(`[data-post-id="${p.id}"] video`) as Element)!, { manual: true })}
              >Make Active</button>
              <span>Tip: click video to play; only one should play at a time.</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4">
        <h2 className="text-sm font-semibold mb-2">DOM order snapshot</h2>
        <button
          className="px-3 py-1 text-xs border rounded"
          onClick={() => {
            const rows: any[] = [];
            const els = document.querySelectorAll('[data-post-id]');
            const seen = new Set<string>();
            els.forEach((el, i) => {
              const id = el.getAttribute('data-post-id') || '';
              if (id && !seen.has(id)) { seen.add(id); rows.push({ domIndex: i, postId: id }); }
            });
            (window as any).__dom_order = rows;
            alert('DOM order captured to window.__dom_order');
          }}
        >Capture DOM order</button>
      </div>
    </div>
  );
}

"use client";
import React, { useEffect, useMemo } from 'react';
import FeedMediaManager, { type VideoHandle, isFastScroll } from '../../components/video/FeedMediaManager';

// Public GCS sample videos (allowed by our /api/video allowlist)
const SOURCES = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
];

export default function TestFeedClient() {
  const tiles = useMemo(() => SOURCES.map((src, i) => ({
    id: `test-${i}`,
    src: `/api/video?url=${encodeURIComponent(src)}&pid=test-${i}`,
    title: `Test Video ${i + 1}`,
  })), []);

  useEffect(() => {
    const ENTER_ACTIVE = 0.75, EXIT_IDLE = 0.40, ENTER_IDLE_SAFE = 0.10;
    const observed = Array.from(document.querySelectorAll('[data-test-id]')) as HTMLElement[];
    const ratios = new Map<HTMLElement, number>();
    const pending = new Map<Element, number>();

    const debugPush = (evt: any) => {
      try {
        const w: any = window as any;
        if (!w.__carrot_feed_log) w.__carrot_feed_log = [];
        const buf = w.__carrot_feed_log as any[];
        const entry = { ts: Date.now(), ...evt };
        buf.push(entry);
        if (buf.length > 500) buf.shift();
        w.dispatchEvent(new CustomEvent('carrot-feed-log', { detail: entry }));
      } catch {}
    };

    // Mark flings immediately and clear previous logs so subsequent collections don't include stale warms
    const onWheel = (e: WheelEvent) => {
      try {
        const screenHeight = Math.max(1, window.innerHeight);
        const dyScreens = Math.abs(e.deltaY) / screenHeight;
        if (dyScreens >= 1.5) {
          const w: any = window as any;
          w.__carrot_last_fling = (typeof performance !== 'undefined') ? performance.now() : Date.now();
          if (Array.isArray(w.__carrot_feed_log)) w.__carrot_feed_log.length = 0; // clear buffer
        }
      } catch {}
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    // Listen for warm events from FeedMediaManager console.debug
    const originalDebug = console.debug;
    console.debug = (...args: any[]) => {
      if (args[0] === 'warm' && args[1]) {
        // Suppress warm capture during fast scroll window
        try { if (isFastScroll && isFastScroll()) { return; } } catch {}
        try {
          const w: any = window as any;
          const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
          const lastFling = w.__carrot_last_fling || 0;
          // Mirror FeedMediaManager cooldown (700ms) to avoid counting warms right after a fling
          if (lastFling && (now - lastFling) < 700) return;
        } catch {}
        // Convert FeedMediaManager warm log to test format
        const handleId = args[1];
        const el = observed.find(el => {
          const handle = FeedMediaManager.inst.getHandleByElement(el);
          return handle && handle.id === handleId;
        });
        if (el) {
          const idx = observed.indexOf(el);
          debugPush({ type: 'warm', index: idx, id: el.getAttribute('data-test-id') });
        }
      }
      originalDebug.apply(console, args);
    };

    // Register video handles with FeedMediaManager
    observed.forEach((el, idx) => {
      const video = el.querySelector('video') as HTMLVideoElement;
      if (!video) return;
      
      const handle: VideoHandle = {
        id: `test-${idx}`,
        el,
        play: async () => {
          try {
            await video.play();
          } catch {}
        },
        pause: () => {
          try {
            video.pause();
          } catch {}
        },
        warm: async () => {
          // For progressive video, just preload metadata
          if (video.preload !== 'metadata') {
            video.preload = 'metadata';
          }
        },
        setPaused: () => {
          try {
            video.pause();
          } catch {}
        },
        release: () => {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
          } catch {}
        },
      };
      
      FeedMediaManager.inst.registerHandle(el, handle);
    });

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        ratios.set(el, e.intersectionRatio);
        const prev = pending.get(el); if (prev) clearTimeout(prev);
      }
      const t = window.setTimeout(() => {
        // Compute Active: element whose center is nearest viewport center among visible ones
        const centerY = window.innerHeight / 2;
        const candidates = observed.filter(el => (ratios.get(el) || 0) > 0);
        let activeEl: HTMLElement | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const el of candidates) {
          const r = el.getBoundingClientRect();
          const elCenter = r.top + r.height / 2;
          const d = Math.abs(elCenter - centerY);
          if (d < bestDist) { bestDist = d; activeEl = el; }
        }
        
        // Use FeedMediaManager for state transitions + debug
        observed.forEach((el, idx) => {
          const handle = FeedMediaManager.inst.getHandleByElement(el);
          if (!handle) return;
          const ratio = ratios.get(el) || 0;
          if (activeEl === el && (ratios.get(el) || 0) >= ENTER_ACTIVE) {
            FeedMediaManager.inst.setActive(handle);
            debugPush({ type: 'active', index: idx, id: el.getAttribute('data-test-id') });
          } else if (ratio <= EXIT_IDLE) {
            if (ratio <= ENTER_IDLE_SAFE) {
              FeedMediaManager.inst.setIdle(handle);
              debugPush({ type: 'idle', index: idx, id: el.getAttribute('data-test-id') });
            } else {
              FeedMediaManager.inst.setPaused(handle);
              debugPush({ type: 'paused', index: idx, id: el.getAttribute('data-test-id') });
            }
          }
        });

        // Warm logic using FeedMediaManager (includes fast-scroll guard)
        if (activeEl) {
          const idx = observed.indexOf(activeEl);
          const warmIdx = idx + 1; // Deterministic: always next tile
          if (warmIdx < observed.length) { // Only if next tile exists
            const warmEl = observed[warmIdx];
            const warmHandle = FeedMediaManager.inst.getHandleByElement(warmEl);
            if (warmHandle && !isFastScroll()) { // Fast-scroll guard: don't warm during flings
              FeedMediaManager.inst.setWarm(warmHandle);
            } else if (warmHandle) {
              console.debug('[TestFeedClient] Blocked warm due to fast scroll');
            }
          }
        }
      }, 180);
      pending.set(entries[0]?.target as HTMLElement, t);
    }, { threshold: [ENTER_IDLE_SAFE, EXIT_IDLE, 0.60, ENTER_ACTIVE] });

    observed.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      observed.forEach((el) => FeedMediaManager.inst.unregisterHandle(el));
      try { window.removeEventListener('wheel', onWheel as any); } catch {}
      try { console.debug = originalDebug; } catch {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Test Feed</h1>
          <p className="text-sm text-gray-600">For E2E testing feed prioritization</p>
        </div>
        
        <div className="space-y-4 p-4">
          {tiles.map((tile, i) => (
            <div key={tile.id} className="bg-gray-100 rounded-lg overflow-hidden" data-test-id={tile.id}>
              <div className="aspect-video bg-black">
                <video
                  className="w-full h-full object-cover"
                  src={tile.src}
                  muted
                  playsInline
                  preload="none"
                />
              </div>
              <div className="p-3">
                <h3 className="font-medium">{tile.title}</h3>
                <p className="text-sm text-gray-500">Test video {i + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
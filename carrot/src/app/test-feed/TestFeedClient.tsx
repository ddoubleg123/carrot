"use client";
import React, { useEffect, useMemo } from 'react';
import FeedMediaManager, { type VideoHandle } from '@/components/video/FeedMediaManager';

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
          const warmIdx = Math.min(observed.length - 1, idx + 1); // Always next tile
          if (warmIdx !== idx) {
            const warmEl = observed[warmIdx];
            const warmHandle = FeedMediaManager.inst.getHandleByElement(warmEl);
            if (warmHandle && (ratios.get(warmEl) || 0) >= 0.10) {
              FeedMediaManager.inst.setWarm(warmHandle); // Uses fast-scroll guard
              debugPush({ type: 'warm', index: warmIdx, id: warmEl.getAttribute('data-test-id') });
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
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {tiles.map((tile, i) => (
        <div
          key={tile.id}
          data-test-id={tile.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 16,
            backgroundColor: '#f9f9f9',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: 18 }}>{tile.title}</h3>
          <video
            src={tile.src}
            controls
            muted
            style={{
              width: '100%',
              maxWidth: 640,
              height: 'auto',
              borderRadius: 4,
            }}
            preload="metadata"
          />
          <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#666' }}>
            Index: {i} | ID: {tile.id}
          </p>
        </div>
      ))}
    </div>
  );
}
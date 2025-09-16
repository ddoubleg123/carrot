"use client";
import React, { useEffect, useMemo } from 'react';

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
    const ENTER_ACTIVE = 0.75, EXIT_IDLE = 0.40;
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

    let lastY = window.scrollY, lastT = performance.now();
    const fastScrollRef = { v: false } as { v: boolean };
    const onScroll = () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastY);
      const dt = Math.max(1, now - lastT);
      const screensPerSec = (dy / Math.max(1, window.innerHeight)) / (dt / 1000);
      fastScrollRef.v = screensPerSec > 1.5;
      lastY = window.scrollY; lastT = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

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
        
        // Play/pause + debug
        observed.forEach((el, idx) => {
          const v = el.querySelector('video') as HTMLVideoElement | null;
          if (!v) return;
          if (activeEl === el && (ratios.get(el) || 0) >= ENTER_ACTIVE) {
            v.play().catch(() => {});
            debugPush({ type: 'active', index: idx, id: el.getAttribute('data-test-id') });
          } else {
            v.pause();
            if ((ratios.get(el) || 0) <= EXIT_IDLE) {
              debugPush({ type: 'idle', index: idx, id: el.getAttribute('data-test-id') });
            }
          }
        });

        // Warm logic (next by scroll direction)
        if (!fastScrollRef.v && activeEl) {
          // Double-check: recompute velocity right before warm decision
          const nowCheck = performance.now();
          const dyCheck = Math.abs(window.scrollY - lastY);
          const dtCheck = Math.max(1, nowCheck - lastT);
          const currentSpeed = (dyCheck / Math.max(1, window.innerHeight)) / (dtCheck / 1000);
          if (currentSpeed > 1.2) return; // Skip warm if still moving fast

          const idx = observed.indexOf(activeEl);
          const dir = (window.scrollY - lastY) >= 0 ? 1 : -1;
          const warmIdx = Math.max(0, Math.min(observed.length - 1, idx + dir));
          if (warmIdx !== idx) {
            const warmEl = observed[warmIdx];
            const warmRatio = ratios.get(warmEl) || 0;
            if (warmEl && warmRatio >= 0.10) {
              debugPush({ type: 'warm', index: warmIdx, id: warmEl.getAttribute('data-test-id') });
            }
          }
        }
      }, 180);
      pending.set(entries[0]?.target as HTMLElement, t);
    }, { threshold: [EXIT_IDLE, 0.60, ENTER_ACTIVE] });

    observed.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
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
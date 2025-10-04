'use client';

import { useEffect, useRef } from 'react';

// Web API types for performance tracking
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Minimal Web Vitals tracking without external deps
// Tracks: CLS, LCP, INP (or FID fallback)
export default function PerfTracker() {
  const sentRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const send = (metric: string, value: number, extra?: Record<string, any>) => {
      try {
        // De-duplicate identical metric sends
        const key = `${metric}`;
        if (sentRef.current[key] && Math.abs(sentRef.current[key] - value) < 0.0001) return;
        sentRef.current[key] = value;
        fetch('/api/telemetry/web-vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ metric, value, path: window.location.pathname, ts: Date.now(), ...extra }),
        }).catch(() => {});
      } catch {}
    };

    // CLS
    let clsValue = 0;
    const clsEntries: LayoutShift[] = [] as any;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntryList & any) {
        // Only count if not triggered by user input
        if (!entry.hadRecentInput) {
          clsValue += entry.value || 0;
          clsEntries.push(entry);
          send('CLS', Number(clsValue.toFixed(4)));
        }
      }
    });
    try { clsObserver.observe({ type: 'layout-shift', buffered: true } as any); } catch {}

    // LCP
    let lcpValue = 0;
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (last) {
        lcpValue = last.renderTime || last.loadTime || last.startTime || 0;
        send('LCP', Number(lcpValue));
      }
    });
    try { lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any); } catch {}

    // INP (or FID fallback)
    let inpObserver: PerformanceObserver | null = null;
    try {
      inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any) {
          const duration = entry.processingEnd ? (entry.processingEnd - entry.startTime) : entry.duration;
          send('INP', Number(duration));
        }
      });
      inpObserver.observe({ type: 'event', buffered: true } as any);
    } catch {
      // Fallback for older browsers: First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const first = list.getEntries()[0] as any;
          if (first) {
            const fid = first.processingStart - first.startTime;
            send('FID', Number(fid));
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true } as any);
      } catch {}
    }

    // First Contentful Paint (optional signal for initial paint)
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            send('FCP', Number(entry.startTime));
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true } as any);
    } catch {}

    return () => {
      try { clsObserver.disconnect(); } catch {}
      try { lcpObserver.disconnect(); } catch {}
      try { inpObserver?.disconnect(); } catch {}
    };
  }, []);

  // No UI output
  return null;
}

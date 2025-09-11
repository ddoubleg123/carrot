"use client";

import React, { useEffect, useRef } from "react";

export default function PlainCanvasDebug({ analyser, visible = true, fullScreen = false, onRequestDisable }: { analyser?: { getRms: () => number; getSpectrum: () => Float32Array } | null; visible?: boolean; fullScreen?: boolean; onRequestDisable?: () => void; }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mounted = true;
    let raf = 0;

    const fit = () => {
      const dpr = Math.max(1, (window as any).devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      (ctx as any).setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestDisable?.();
    };
    window.addEventListener('keydown', onKey);

    let frame = 0;
    const bars = 32;
    const loop = () => {
      if (!mounted) return;
      frame++;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      // strict source-over opaque draw
      (ctx as any).globalAlpha = 1;
      (ctx as any).globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);

      // sample
      let rms = 0;
      let spec: Float32Array | null = null;
      try {
        rms = analyser?.getRms?.() ?? 0;
      } catch {}
      try {
        const A = analyser?.getSpectrum?.();
        if (A && A.length) spec = A;
      } catch {}

      // draw RMS text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillText(`RMS ${rms.toFixed(3)}  •  frame ${frame}`, 12, 26);

      // draw bars
      const N = bars;
      const pad = 16;
      const availW = w - pad * 2;
      const barW = availW / N - 4;
      const baseY = h - 40;
      ctx.fillStyle = '#00E0FF';
      for (let i = 0; i < N; i++) {
        const x = pad + i * (barW + 4);
        let v = 0.1 + 0.8 * Math.abs(Math.sin((frame * 0.05) + i * 0.3));
        if (spec) {
          const idx = Math.min(spec.length - 1, Math.floor((i / N) * spec.length));
          v = Math.max(v * 0.25, spec[idx]);
        }
        const hgt = Math.max(4, (h * 0.4) * v);
        ctx.fillRect(x, baseY - hgt, barW, hgt);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [visible, analyser, onRequestDisable]);

  if (!visible) return null;

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: fullScreen ? 0 : 'auto',
        bottom: 0,
        height: fullScreen ? '100%' : '38%',
        zIndex: 99999,
        pointerEvents: 'none',
        background: '#111',
      }}
      aria-hidden
    />
  );
}

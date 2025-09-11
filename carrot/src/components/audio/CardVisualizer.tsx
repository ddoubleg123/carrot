"use client";

import React, { useEffect, useRef } from "react";

export type CardVisualizerProps = {
  analyser?: { getRms: () => number; getSpectrum: () => Float32Array } | null;
  style?: 'arc' | 'radial' | 'liquid';
  intensity?: number; // 0..1
  avatarSrc?: string | null; // real avatar URL if available
  palette?: { from: string; to: string } | null; // background/field colors
};

// Single-canvas renderer that paints: background gradient, animated field, heartbeat rings, and avatar badge.
export default function CardVisualizer({ analyser, style = 'radial', intensity = 0.9, avatarSrc = null, palette = null }: CardVisualizerProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load avatar image when URL provided
  useEffect(() => {
    if (!avatarSrc) { imgRef.current = null; return; }
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { imgRef.current = img; };
      img.onerror = () => { imgRef.current = null; };
      img.src = avatarSrc;
    } catch {
      imgRef.current = null;
    }
  }, [avatarSrc]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let running = true;
    let last = 0;

    const resize = () => {
      const dpr = Math.max(1, (window as any).devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      (ctx as any).setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new (window as any).ResizeObserver(resize);
    ro.observe(canvas);

    const drawBg = (g: CanvasRenderingContext2D, w: number, h: number) => {
      const grad = g.createLinearGradient(0, 0, w, h);
      const from = palette?.from || '#FF6A00';
      const to = palette?.to || '#0A5AFF';
      grad.addColorStop(0, from);
      grad.addColorStop(1, to);
      g.fillStyle = grad as any;
      g.fillRect(0, 0, w, h);
    };

    const drawField = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const cx = w / 2, cy = h / 2;
      const spec = analyser?.getSpectrum?.();
      const rms = (() => { try { return analyser?.getRms?.() ?? 0; } catch { return 0; } })();

      if (style === 'liquid') {
        const scale = intensity ?? 0.9;
        const from = palette?.from || '#FF6A00';
        const to = palette?.to || '#0A5AFF';
        const blobs = [
          { x: cx + Math.sin(t * 0.0007) * 14, y: cy + Math.cos(t * 0.0009) * 14, r: Math.min(w, h) * (0.22 + 0.18 * (rms || 0.4) * scale), c: hexWithAlpha(from, 0.22) },
          { x: cx + Math.cos(t * 0.0006 + 1.2) * 16, y: cy + Math.sin(t * 0.0005 + 0.6) * 16, r: Math.min(w, h) * (0.20 + 0.16 * (rms || 0.3) * scale), c: hexWithAlpha(to, 0.22) },
        ];
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.filter = 'blur(12px)';
        for (const b of blobs) { g.beginPath(); g.fillStyle = b.c; g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); }
        g.filter = 'none'; g.restore();
        return;
      }

      if (style === 'arc') {
        const radius = Math.min(w, h) * 0.42;
        const N = 72;
        const maxLen = radius * 0.55 * (intensity ?? 0.9);
        g.save();
        g.translate(cx, cy);
        g.rotate(-Math.PI);
        g.lineWidth = 4;
        const from = palette?.from || '#FF6A00';
        const to = palette?.to || '#0A5AFF';
        for (let i = 0; i < N; i++) {
          const a = (i / (N - 1)) * Math.PI;
          const val = spec && (spec as any).length ? (spec as any)[Math.min((spec as any).length - 1, Math.floor(i * ((spec as any).length / N)))] : (0.35 + 0.25 * (Math.sin(t * 0.002 + i * 0.3) + 1) / 2);
          const len = Math.max(0.05, val) * maxLen;
          const x1 = Math.cos(a) * (radius - 4);
          const y1 = Math.sin(a) * (radius - 4);
          const x2 = Math.cos(a) * (radius - 4 - len);
          const y2 = Math.sin(a) * (radius - 4 - len);
          g.strokeStyle = i < N/2 ? hexWithAlpha(from, 0.95) : hexWithAlpha(to, 0.95);
          g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
        }
        g.restore();
        return;
      }

      // radial (default)
      const radius = Math.min(w, h) * 0.46;
      const N = 140;
      g.save();
      g.translate(cx, cy);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 2;
      const baseAmp = 0.12 + 0.3 * rms;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const nx = Math.cos(angle), ny = Math.sin(angle);
        const val = spec && (spec as any).length ? (spec as any)[Math.min((spec as any).length - 1, Math.floor(i * ((spec as any).length / N)))] : (0.4 + 0.15 * Math.sin(t * 0.001 + i * 0.2));
        const amp = baseAmp + 0.2 * val;
        const r1 = radius * (0.55 - 0.25 * amp);
        const r2 = radius * (0.55 + 0.75 * amp);
        g.beginPath(); g.moveTo(nx * r1, ny * r1); g.lineTo(nx * r2, ny * r2); g.stroke();
      }
      g.restore();
    };

    const drawRingsAndAvatar = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const cx = w / 2, cy = h / 2;
      const avatar = Math.max(64, Math.min(84, Math.floor(Math.min(w, h) * 0.28)));
      const r = avatar / 2;
      const rms = (() => { try { return analyser?.getRms?.() ?? 0; } catch { return 0; } })();

      // rings
      g.save();
      const ringBase = r + 8;
      const ringOffsets = [0, 10, 20];
      for (let i = 0; i < ringOffsets.length; i++) {
        const rr = ringBase + ringOffsets[i] + 6 * (0.5 + 0.5 * Math.sin(t * 0.003 + i * 0.6)) + 10 * rms;
        g.strokeStyle = `rgba(255,255,255,${0.5 - i * 0.12})`;
        g.lineWidth = i === 0 ? 2 : 1;
        g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
      }
      g.restore();

      // avatar badge - real image if available, else gradient placeholder
      const drawFallback = () => {
        const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grad.addColorStop(0, '#ffd1a3');
        grad.addColorStop(1, '#ff8a00');
        g.fillStyle = grad as any;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff';
        g.font = `${Math.floor(r * 1.3)}px Segoe UI, Roboto, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('D', cx, cy + 2);
      };
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          g.save();
          g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
          g.drawImage(img, cx - r, cy - r, r * 2, r * 2);
          g.restore();
        } catch { drawFallback(); }
      } else {
        drawFallback();
      }
    };

    const loop = (ts: number) => {
      if (!running) return;
      if (ts - last < 22) { raf.current = requestAnimationFrame(loop); return; }
      last = ts;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      drawBg(ctx, w, h);
      drawField(ctx, w, h, ts);
      drawRingsAndAvatar(ctx, w, h, ts);
      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf.current); ro.disconnect(); };
  }, [analyser, style, intensity, avatarSrc]);

  return <canvas ref={ref} className="w-full h-full" style={{ display: 'block', background: 'transparent', pointerEvents: 'none' }} />;
}

// local copy (avoids importing from AudioHero)
function hexWithAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

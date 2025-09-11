"use client";

import React, { useEffect, useRef } from "react";

export type BackgroundFieldProps = {
  analyser?: { getRms: () => number; getSpectrum: () => Float32Array } | null;
  style?: 'arc' | 'radial' | 'liquid';
  intensity?: number;
};

export default function BackgroundField({ analyser, style = 'radial', intensity = 0.8 }: BackgroundFieldProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let running = true;
    let lastT = 0;

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

    const drawRadial = (t: number) => {
      const g = ctx as CanvasRenderingContext2D;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      g.clearRect(0, 0, w, h);
      // Internal gradient background (prevents white panels)
      const bgGrad = g.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#FF6A00');
      bgGrad.addColorStop(1, '#0A5AFF');
      g.fillStyle = bgGrad as any; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) * 0.48;
      const N = 140;
      const spec = analyser?.getSpectrum?.();
      let baseAmp = 0.12;
      if (analyser) baseAmp = 0.10 + 0.25 * Math.min(1, analyser.getRms());
      g.save();
      g.translate(cx, cy);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = 1.8;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const nx = Math.cos(angle), ny = Math.sin(angle);
        let amp = baseAmp;
        if (spec && (spec as any).length) {
          const idx = Math.floor((i / N) * Math.min((spec as any).length - 1, 256));
          amp += 0.18 * (spec as any)[idx];
        } else {
          amp += 0.05 * Math.sin(t * 0.001 + i * 0.2);
        }
        const r1 = radius * (0.45 - 0.2 * amp);
        const r2 = radius * (0.65 + 0.9 * amp) * (intensity ?? 0.8);
        g.beginPath();
        g.moveTo(nx * r1, ny * r1);
        g.lineTo(nx * r2, ny * r2);
        g.stroke();
      }
      g.restore();
    };

    const drawLiquid = (t: number) => {
      const g = ctx as CanvasRenderingContext2D;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      g.clearRect(0, 0, w, h);
      const bgGrad = g.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#FF6A00');
      bgGrad.addColorStop(1, '#0A5AFF');
      g.fillStyle = bgGrad as any; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const spec = analyser?.getSpectrum?.();
      let bass = 0.2 + 0.1 * Math.sin(t * 0.001);
      let mids = 0.2 + 0.1 * Math.cos(t * 0.0013);
      if (spec && (spec as any).length) {
        const A = spec as any as Float32Array;
        const n = A.length;
        const nb = Math.max(1, Math.floor(n * 0.08));
        const nm = Math.max(1, Math.floor(n * 0.25));
        bass = 0; mids = 0;
        for (let i = 0; i < nb; i++) bass += A[i];
        for (let i = nb; i < nm; i++) mids += A[i];
        bass /= nb; mids /= (nm - nb);
      }
      const scale = intensity ?? 0.8;
      const blobs = [
        { x: cx + Math.sin(t * 0.0007) * 10, y: cy + Math.cos(t * 0.0009) * 10, r: Math.min(w, h) * (0.20 + 0.16 * bass * scale), c: 'rgba(255,106,0,0.18)' },
        { x: cx + Math.cos(t * 0.0006 + 1.2) * 12, y: cy + Math.sin(t * 0.0005 + 0.6) * 12, r: Math.min(w, h) * (0.18 + 0.14 * mids * scale), c: 'rgba(10,90,255,0.18)' },
      ];
      g.save();
      // Use normal source-over to avoid washing out the gradient
      g.globalCompositeOperation = 'source-over';
      g.filter = 'blur(8px)';
      for (const b of blobs) {
        g.beginPath(); g.fillStyle = b.c; g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      }
      g.filter = 'none';
      g.restore();
    };

    const drawArc = (t: number) => {
      const g = ctx as CanvasRenderingContext2D;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      g.clearRect(0, 0, w, h);
      const bgGrad = g.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#FF6A00');
      bgGrad.addColorStop(1, '#0A5AFF');
      g.fillStyle = bgGrad as any; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) * 0.46;
      const spec = analyser?.getSpectrum?.();
      const N = 64;
      const bars: number[] = new Array(N).fill(0);
      if (spec && (spec as any).length) {
        const A = spec as any as Float32Array;
        const step = Math.max(1, Math.floor(A.length / N));
        for (let i = 0; i < N; i++) {
          let s = 0; for (let k = 0; k < step; k++) s += A[Math.min(A.length - 1, i * step + k)];
          bars[i] = s / step;
        }
      } else {
        for (let i = 0; i < N; i++) bars[i] = 0.2 + 0.1 * Math.sin(t * 0.001 + i * 0.3);
      }
      g.save();
      g.translate(cx, cy);
      g.rotate(-Math.PI);
      g.lineWidth = 3;
      for (let i = 0; i < N; i++) {
        const a = (i / (N - 1)) * Math.PI;
        const len = bars[i] * radius * 0.5 * (intensity ?? 0.8);
        const x1 = Math.cos(a) * (radius - 4);
        const y1 = Math.sin(a) * (radius - 4);
        const x2 = Math.cos(a) * (radius - 4 - len);
        const y2 = Math.sin(a) * (radius - 4 - len);
        g.strokeStyle = i < N/2 ? 'rgba(255,106,0,0.85)' : 'rgba(10,90,255,0.85)';
        g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
      }
      g.restore();
    };

    const loop = (ts: number) => {
      if (!running) return;
      if (ts - lastT < 22) { rafRef.current = requestAnimationFrame(loop); return; }
      lastT = ts;
      const m = style;
      if (m === 'liquid') drawLiquid(ts);
      else if (m === 'arc') drawArc(ts);
      else drawRadial(ts);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => { running = false; cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [analyser, style, intensity]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0"
      style={{ display: 'block', background: 'transparent', pointerEvents: 'none' }}
    />
  );
}

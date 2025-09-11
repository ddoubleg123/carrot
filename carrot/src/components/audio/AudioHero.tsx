"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type FieldStyle = 'radial' | 'liquid' | 'arc';

export type AudioHeroProps = {
  avatarSrc?: string | null;
  state?: 'idle' | 'playing' | 'paused' | 'error';
  style?: FieldStyle;
  intensity?: number; // 0..1
  className?: string;
  analyser?: { getRms: () => number; getSpectrum: () => Float32Array } | null;
  size?: number; // px, outer container size
};

// Tokens
const ORANGE = '#FF6A00';
const BLUE = '#0A5AFF';

export default function AudioHero({
  avatarSrc,
  state = 'idle',
  style = 'radial',
  intensity = 0.8,
  className = '',
  analyser,
  size = 112,
}: AudioHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [playing, setPlaying] = useState(state === 'playing');
  const [mode, setMode] = useState<FieldStyle>(style);

  useEffect(() => { setPlaying(state === 'playing'); }, [state]);

  // Runtime style override via localStorage or env var
  useEffect(() => {
    try {
      const read = () => {
        let v: any = undefined;
        try {
          v = (window.localStorage.getItem('carrot_audio_field_style') || '').toLowerCase();
        } catch {}
        if (v !== 'radial' && v !== 'liquid' && v !== 'arc') {
          // fallback to env default
          const env = (process.env.NEXT_PUBLIC_AUDIO_FIELD_STYLE || '').toLowerCase();
          v = (env === 'liquid' || env === 'arc' || env === 'radial') ? env : style;
        }
        setMode(v as FieldStyle);
      };
      read();
      const onStorage = (e: StorageEvent) => {
        if (e.key === 'carrot_audio_field_style') read();
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    } catch {
      setMode(style);
    }
  }, [style]);

  // Canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
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

    function drawRadial(t: number) {
      const c = canvas as HTMLCanvasElement;
      const g = ctx as CanvasRenderingContext2D;
      const w = c.clientWidth;
      const h = c.clientHeight;
      g.clearRect(0, 0, w, h);
      // Gradient subtle bg overlay
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, hexWithAlpha(ORANGE, 0.10));
      grd.addColorStop(1, hexWithAlpha(BLUE, 0.10));
      g.fillStyle = grd as any;
      g.fillRect(0, 0, w, h);

      // Center
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) * 0.48;
      const N = 120; // lines
      const spec = analyser?.getSpectrum?.();
      let base = 0.12;
      if (analyser) {
        const rms = clamp(analyser.getRms(), 0, 1);
        base = 0.10 + 0.25 * rms * (intensity ?? 0.8);
      } else if (playing) {
        base = 0.16 + 0.04 * Math.sin(t * 0.002);
      }
      (g as any).save();
      (g as any).translate(cx, cy);
      (g as any).globalAlpha = prefersReducedMotion ? 0.15 : 0.22;
      (g as any).strokeStyle = hexWithAlpha('#ffffff', 0.5);
      (g as any).lineWidth = 1.5;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const nx = Math.cos(angle), ny = Math.sin(angle);
        let amp = base;
        if (spec && (spec as any).length > 0) {
          const idx = Math.floor((i / N) * Math.min((spec as any).length - 1, 256));
          amp += 0.18 * (spec as any)[idx];
        } else if (!prefersReducedMotion) {
          amp += 0.05 * Math.sin(t * 0.001 + i * 0.2);
        }
        const r1 = radius * (0.6 - 0.2 * amp);
        const r2 = radius * (0.6 + 0.6 * amp);
        (g as any).beginPath();
        (g as any).moveTo(nx * r1, ny * r1);
        (g as any).lineTo(nx * r2, ny * r2);
        (g as any).stroke();
      }
      (g as any).restore();
    };

    const drawLiquid = (t: number) => {
      const c = canvas as HTMLCanvasElement;
      const g = ctx as CanvasRenderingContext2D;
      const w = c.clientWidth;
      const h = c.clientHeight;
      g.clearRect(0, 0, w, h);
      // soft gradient wash
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, hexWithAlpha(ORANGE, 0.10));
      grd.addColorStop(1, hexWithAlpha(BLUE, 0.10));
      g.fillStyle = grd as any;
      g.fillRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      const spec = analyser?.getSpectrum?.();
      // derive band energies
      let bass = 0, mids = 0;
      if (spec && (spec as any).length > 0) {
        const A = spec as any as Float32Array;
        const n = A.length;
        const nb = Math.max(1, Math.floor(n * 0.08));
        const nm = Math.max(1, Math.floor(n * 0.25));
        for (let i = 0; i < nb; i++) bass += A[i];
        for (let i = nb; i < nm; i++) mids += A[i];
        bass /= nb; mids /= (nm - nb);
      } else {
        // idle motion
        bass = 0.2 + 0.1 * Math.sin(t * 0.001);
        mids = 0.2 + 0.1 * Math.cos(t * 0.0013);
      }

      const scale = (intensity ?? 0.8);
      const blobs = [
        { x: cx + Math.sin(t * 0.0007) * 6, y: cy + Math.cos(t * 0.0009) * 6, r: Math.min(w, h) * (0.18 + 0.14 * bass * scale), c: ORANGE },
        { x: cx + Math.cos(t * 0.0006 + 1.2) * 8, y: cy + Math.sin(t * 0.0005 + 0.6) * 8, r: Math.min(w, h) * (0.15 + 0.12 * mids * scale), c: BLUE },
        { x: cx + Math.cos(t * 0.0004) * 4, y: cy + Math.sin(t * 0.0007) * 4, r: Math.min(w, h) * (0.10 + 0.08 * (0.5 * bass + 0.5 * mids) * scale), c: '#ffffff' },
      ];

      g.save();
      (g as any).globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        g.beginPath();
        g.fillStyle = hexWithAlpha(b.c, prefersReducedMotion ? 0.12 : 0.18);
        g.filter = 'blur(12px)';
        g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        g.fill();
      }
      g.filter = 'none';
      g.restore();
    }

    function drawArc(t: number) {
      const c = canvas as HTMLCanvasElement;
      const g = ctx as CanvasRenderingContext2D;
      const w = c.clientWidth;
      const h = c.clientHeight;
      g.clearRect(0, 0, w, h);

      // subtle gradient fill
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, hexWithAlpha(ORANGE, 0.10));
      grd.addColorStop(1, hexWithAlpha(BLUE, 0.10));
      g.fillStyle = grd as any;
      g.fillRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) * 0.46;
      const N = 64; // bar count
      const spec = analyser?.getSpectrum?.();
      const bars: number[] = new Array(N).fill(0);
      if (spec && (spec as any).length > 0) {
        const A = spec as any as Float32Array;
        const step = Math.max(1, Math.floor(A.length / N));
        for (let i = 0; i < N; i++) {
          let s = 0;
          for (let k = 0; k < step; k++) s += A[Math.min(A.length - 1, i * step + k)];
          bars[i] = s / step; // 0..1
        }
      } else {
        for (let i = 0; i < N; i++) bars[i] = 0.2 + 0.1 * Math.sin(t * 0.001 + i * 0.3);
      }

      const maxLen = radius * 0.35 * (intensity ?? 0.8);
      g.save();
      g.translate(cx, cy);
      g.rotate(-Math.PI); // start at 180° left side
      g.lineWidth = 2;
      for (let i = 0; i < N; i++) {
        const a = (i / (N - 1)) * Math.PI; // 180° arc
        const len = (prefersReducedMotion ? 0.12 : bars[i]) * maxLen;
        const x1 = Math.cos(a) * (radius - 4);
        const y1 = Math.sin(a) * (radius - 4);
        const x2 = Math.cos(a) * (radius - 4 - len);
        const y2 = Math.sin(a) * (radius - 4 - len);
        const col = i < N / 2 ? ORANGE : BLUE;
        (g as any).strokeStyle = hexWithAlpha(col, 0.45);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      g.restore();
    }

    const loop = (ts: number) => {
      if (!running) return;
      // Cap to ~45fps
      if (ts - lastT < 22) { rafRef.current = requestAnimationFrame(loop); return; }
      lastT = ts;
      if (prefersReducedMotion) {
        drawRadial(0);
      } else {
        const m = mode || style;
        if (m === 'liquid') drawLiquid(ts);
        else if (m === 'arc') drawArc(ts);
        else /* radial & default */ drawRadial(ts);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [analyser, intensity, playing, style, mode, prefersReducedMotion]);

  // IntersectionObserver to stop rendering offscreen
  useEffect(() => {
    const el = canvasRef.current as any;
    if (!el || !(window as any).IntersectionObserver) return;
    const io = new (window as any).IntersectionObserver((entries: any[]) => {
      const e = entries[0];
      if (!e.isIntersecting) cancelAnimationFrame(rafRef.current);
    }, { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const avatarSize = Math.round(size * 0.85);
  return (
    <div className={[
      'relative rounded-full overflow-visible select-none',
      'grid place-items-center',
      className,
    ].join(' ')} style={{ width: size, height: size }}>
      {/* Canvas audio field behind */}
      <div className="absolute inset-0 -z-10">
        <canvas ref={canvasRef} className="w-full h-full" style={{ filter: 'blur(10px)' }} />
      </div>

      {/* Concentric rings */}
      <div className="absolute inset-0 pointer-events-none">
        <Ring index={0} delay={0} prefersReducedMotion={prefersReducedMotion} />
        <Ring index={1} delay={300} prefersReducedMotion={prefersReducedMotion} />
        <Ring index={2} delay={600} prefersReducedMotion={prefersReducedMotion} />
        <Ring index={3} delay={900} prefersReducedMotion={prefersReducedMotion} />
      </div>

      {/* Avatar */}
      <div className="relative rounded-full p-[2px] bg-white">
        <div className="rounded-full overflow-hidden shadow-sm" style={{ width: avatarSize, height: avatarSize }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarSrc ? <img src={String(avatarSrc)} alt="avatar" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-gray-200"/>}
        </div>
      </div>
    </div>
  );
}

function Ring({ index, delay, prefersReducedMotion }: { index: number; delay: number; prefersReducedMotion: boolean }) {
  // Compute size relative to parent via CSS transforms; base approximates inner radii
  const base = 60 + index * 12; // px relative baseline; container sets absolute size
  const border = index === 0 ? 2 : 1;
  const duration = prefersReducedMotion ? 0 : 7000 + index * 600;
  const opacity = prefersReducedMotion ? 0.25 : 0.35 - index * 0.05;
  return (
    <div
      className="absolute rounded-full"
      style={{
        width: base,
        height: base,
        borderRadius: '9999px',
        border: `${border}px solid rgba(255,255,255,0.6)`,
        mixBlendMode: 'screen',
        opacity,
        animation: prefersReducedMotion ? undefined : `ah-breathe ${duration}ms ${delay}ms ease-in-out infinite alternate`,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const mq = (window as any).matchMedia('(prefers-reduced-motion: reduce)');
      const on = () => setReduced(mq.matches);
      on();
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    } catch { setReduced(false); }
  }, []);
  return reduced;
}

function hexWithAlpha(hex: string, alpha: number) {
  // hex like #RRGGBB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Keyframes (inject once)
let injected = false as any;
if (typeof document !== 'undefined' && !injected) {
  injected = true;
  const css = `@keyframes ah-breathe { 0% { transform: translate(-50%, -50%) scale(0.98); } 100% { transform: translate(-50%, -50%) scale(1.02); } }`;
  const style = document.createElement('style');
  (style as any).textContent = css;
  document.head.appendChild(style);
}

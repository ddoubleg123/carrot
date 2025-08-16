"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  size?: number; // canvas size in px
  avatarUrl: string;
  accentColor?: string; // optional manual override
  background?: string; // css color
  barCount?: number; // number of bars around the circle
  thickness?: number; // bar thickness
  speed?: number; // animation speed multiplier
  username?: string;
  playing?: boolean; // whether audio is playing
  intensity?: number; // 0..1 visual intensity
};

// Deterministic pseudo-random based on a string (e.g., audioUrl)
function hashString(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number) {
  // xorshift32
  let x = seed || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
}

export default function CircularAudioVisualizer({
  size = 280,
  avatarUrl,
  accentColor,
  background = "#ffffff",
  barCount = 72,
  thickness = 4,
  speed = 1,
  username,
  playing = false,
  intensity = 0.6,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);
  const [derivedColor, setDerivedColor] = useState<string | null>(null);
  const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Load avatar
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = avatarUrl;
    img.onload = () => setAvatarImg(img);
    img.onerror = () => setAvatarImg(null);
  }, [avatarUrl]);

  // Derive a color from avatar (simple average) if no accentColor provided
  useEffect(() => {
    if (accentColor || !avatarImg) return;
    try {
      const tmp = document.createElement("canvas");
      const ctx = tmp.getContext("2d");
      if (!ctx) return;
      const w = 32, h = 32;
      tmp.width = w; tmp.height = h;
      ctx.drawImage(avatarImg, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 64) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (n > 0) {
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        setDerivedColor(`rgb(${r}, ${g}, ${b})`);
      }
    } catch {
      // ignore
    }
  }, [avatarImg, accentColor]);

  const color = accentColor || derivedColor || "#FF7A59"; // fallback brand-ish

  // Precompute baseline magnitudes (deterministic idle motion)
  const baseMagnitudes = useMemo(() => {
    const seed = hashString(avatarUrl);
    const rnd = seededRandom(seed);
    const mags = Array.from({ length: barCount }, () => 0.4 + rnd() * 0.6);
    return mags;
  }, [avatarUrl, barCount]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;

    const logicalSize = size * devicePixelRatio;
    canvas.width = logicalSize;
    canvas.height = logicalSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    let raf = 0;
    let t = 0;

    function draw() {
      const playSpeed = speed * (playing ? 1.2 : 0.7);
      t += 0.016 * playSpeed; // ~60fps step
      context.clearRect(0, 0, logicalSize, logicalSize);

      // background
      context.fillStyle = background as string;
      context.fillRect(0, 0, logicalSize, logicalSize);

      const cx = logicalSize / 2;
      const cy = logicalSize / 2;
      const radius = logicalSize * 0.28; // avatar radius

      // Avatar circle mask
      if (avatarImg) {
        context.save();
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.closePath();
        context.clip();
        // draw avatar centered as cover
        const imgRatio = avatarImg.width / avatarImg.height;
        const side = radius * 2;
        let dw = side, dh = side;
        if (imgRatio > 1) {
          dw = side * imgRatio;
        } else {
          dh = side / imgRatio;
        }
        context.drawImage(avatarImg, cx - dw / 2, cy - dh / 2, dw, dh);
        context.restore();
      } else {
        // Placeholder circle
        context.fillStyle = "#eee";
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.fill();
      }

      // Ring baseline
      context.strokeStyle = `${color}33`;
      context.lineWidth = thickness * devicePixelRatio;
      context.beginPath();
      context.arc(cx, cy, radius + logicalSize * 0.06, 0, Math.PI * 2);
      context.stroke();

      // Circle bars
      const bars = barCount;
      const outerR = radius + logicalSize * 0.08;
      const innerR = outerR - logicalSize * 0.02;
      for (let i = 0; i < bars; i++) {
        const ang = (i / bars) * Math.PI * 2;
        const wobble = Math.sin(t * 2 + i * 0.35) * (playing ? 0.28 : 0.12);
        const base = baseMagnitudes[i] * (0.8 + wobble);
        const amp = playing ? Math.min(1, base * (0.9 + intensity * 0.6)) : Math.min(1, base * (0.6 + intensity * 0.2));
        const h = logicalSize * 0.035 * amp;
        const x1 = cx + Math.cos(ang) * innerR;
        const y1 = cy + Math.sin(ang) * innerR;
        const x2 = cx + Math.cos(ang) * (innerR + h);
        const y2 = cy + Math.sin(ang) * (innerR + h);

        context.strokeStyle = color as string;
        context.lineWidth = thickness * devicePixelRatio;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
      }

      // Username text (optional)
      if (username) {
        context.fillStyle = "#222";
        context.font = `${14 * devicePixelRatio}px ui-sans-serif, system-ui, -apple-system`;
        context.textAlign = "center";
        context.fillText(`@${username}`, cx, cy + radius + logicalSize * 0.16);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, background, thickness, barCount, baseMagnitudes, speed, avatarImg, color, devicePixelRatio, playing, intensity]);

  return (
    <div className="w-full max-w-full min-w-0 flex items-center justify-center">
      {/* SSR-safe placeholder: canvas updates after mount */}
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

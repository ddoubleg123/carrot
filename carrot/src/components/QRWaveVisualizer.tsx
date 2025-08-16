"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

// A QR-like animated grid visualizer that responds to playback state.
// Not a scannable QR, but evokes the aesthetic with finder squares and modular tiles.

export type QRWaveVisualizerProps = {
  size?: number; // px
  playing?: boolean;
  intensity?: number; // 0..1
  accentColor?: string;
  background?: string;
  grid?: number; // tiles per side (excluding finders). Keep even like 24 or 28
  progress?: number; // 0..1 normalized playback progress
  avatarUrl?: string; // optional image to colorize dots
};

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

export default function QRWaveVisualizer({
  size = 240,
  playing = false,
  intensity = 0.7,
  accentColor,
  background = "#ffffff",
  grid = 28,
  progress = 0,
  avatarUrl,
}: QRWaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const [avatarMap, setAvatarMap] = useState<ImageData | null>(null);
  const [dominant, setDominant] = useState<[number, number, number] | null>(null);
  const [brandImg, setBrandImg] = useState<HTMLImageElement | null>(null);

  // Choose colors
  const colors = useMemo(() => {
    // If avatar dominant color exists and no explicit accent, use it to theme
    if (!accentColor && dominant) {
      const base = rgbToHex(dominant[0], dominant[1], dominant[2]);
      // dim: mix base with white 70%
      const dimRgb: [number, number, number] = [
        Math.round(dominant[0] * 0.3 + 255 * 0.7),
        Math.round(dominant[1] * 0.3 + 255 * 0.7),
        Math.round(dominant[2] * 0.3 + 255 * 0.7),
      ];
      const dim = rgbToHex(dimRgb[0], dimRgb[1], dimRgb[2]);
      return { base, dim };
    }
    const base = accentColor || "#f97316"; // fallback carrot 500
    const dim = "#e2e8f0"; // slate-200
    return { base, dim };
  }, [accentColor, dominant]);

  // Build a low-res color map from the avatar that matches the grid resolution.
  useEffect(() => {
    let revoked = false;
    if (!avatarUrl) { setAvatarMap(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async" as any;
    img.src = avatarUrl;
    img.onload = () => {
      if (revoked) return;
      // Draw with object-fit: cover onto grid x grid canvas
      const off = document.createElement('canvas');
      off.width = grid; off.height = grid;
      const octx = off.getContext('2d');
      if (!octx) return;
      octx.fillStyle = '#fff';
      octx.fillRect(0,0,grid,grid);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (iw === 0 || ih === 0) { setAvatarMap(null); return; }
      // cover fit
      const targetW = grid;
      const targetH = grid;
      const s = Math.max(targetW/iw, targetH/ih);
      const dw = iw * s;
      const dh = ih * s;
      const dx = (targetW - dw) / 2;
      const dy = (targetH - dh) / 2;
      octx.drawImage(img, dx, dy, dw, dh);
      try {
        const data = octx.getImageData(0, 0, grid, grid);
        setAvatarMap(data);
        // compute dominant average color
        let tr = 0, tg = 0, tb = 0, count = grid * grid;
        for (let i = 0; i < data.data.length; i += 4) {
          tr += data.data[i];
          tg += data.data[i+1];
          tb += data.data[i+2];
        }
        setDominant([Math.round(tr / count), Math.round(tg / count), Math.round(tb / count)]);
      } catch (e) {
        // Tainted canvas due to CORS; fall back to no avatarMap and no dominant
        setAvatarMap(null);
        setDominant(null);
      }
    };
    img.onerror = () => setAvatarMap(null);
    return () => { revoked = true; };
  }, [avatarUrl, grid]);

  // Load brand logo once (from public)
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    // For same-origin public assets, avoid setting crossOrigin to prevent odd failures
    img.decoding = 'async' as any;
    img.src = '/carrot-logo.png';
    img.onload = () => { if (!cancelled) setBrandImg(img); };
    img.onerror = () => { if (!cancelled) setBrandImg(null); };
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;

    const logical = size * dpr;
    canvas.width = logical;
    canvas.height = logical;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const tile = logical / grid;

    let t = 0;
    let raf = 0;

    // Helper to draw a finder square (like QR corners)
    function drawFinder(cx: number, cy: number) {
      const s = tile * 6; // finder size
      context.save();
      context.translate(cx, cy);
      const [br, bg, bb] = hexToRgb(colors.base);
      // dark ring from base → mix with black
      const darkR = Math.round(br * 0.25);
      const darkG = Math.round(bg * 0.25);
      const darkB = Math.round(bb * 0.25);
      context.fillStyle = `rgb(${darkR}, ${darkG}, ${darkB})`;
      context.fillRect(-s/2, -s/2, s, s);
      context.fillStyle = background as string;
      context.fillRect(-s/2 + tile, -s/2 + tile, s - 2*tile, s - 2*tile);
      context.fillStyle = colors.base;
      context.fillRect(-s/2 + 2*tile, -s/2 + 2*tile, s - 4*tile, s - 4*tile);
      context.restore();
    }

    // Brand finder (same layout as drawFinder) with logo drawn inside
    function drawBrandFinder(cx: number, cy: number) {
      const s = tile * 6;
      context.save();
      context.translate(cx, cy);
      const [br, bg, bb] = hexToRgb(colors.base);
      const darkR = Math.round(br * 0.25);
      const darkG = Math.round(bg * 0.25);
      const darkB = Math.round(bb * 0.25);
      // Outer
      context.fillStyle = `rgb(${darkR}, ${darkG}, ${darkB})`;
      context.fillRect(-s/2, -s/2, s, s);
      // Middle (white box)
      const mx = -s/2 + tile;
      const my = -s/2 + tile;
      const mw = s - 2*tile;
      const mh = s - 2*tile;
      context.fillStyle = background as string;
      context.fillRect(mx, my, mw, mh);

      // Draw brand image (carrot) to FILL the white box (cover), clipped to the white area
      if (brandImg) {
        context.save();
        context.beginPath();
        context.rect(mx, my, mw, mh);
        context.clip();
        const sImg = Math.max(mw / brandImg.width, mh / brandImg.height);
        const dw = brandImg.width * sImg;
        const dh = brandImg.height * sImg;
        const dx = mx + (mw - dw) / 2;
        const dy = my + (mh - dh) / 2;
        context.drawImage(brandImg, dx, dy, dw, dh);
        context.restore();
      }

      context.restore();
    }

    function draw() {
      const speed = playing ? 1.6 : 0.6;
      t += 0.016 * speed; // ~60fps

      // background
      context.fillStyle = background as string;
      context.fillRect(0, 0, logical, logical);

      // Tiles
      // Wave field comes from multiple sin sources to feel organic
      const cx = logical / 2;
      const cy = logical / 2;

      // Precompute a smooth sweep offset from progress that loops nicely
      const sweep = Math.max(0, Math.min(1, progress || 0));
      const sweepCol = sweep * (grid - 1);
      
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          const x = gx * tile + tile / 2;
          const y = gy * tile + tile / 2;

          // radial waves from center + two offset emitters
          const r = Math.hypot(x - cx, y - cy) / logical; // 0..~1
          const a = Math.atan2(y - cy, x - cx);

          // progress-driven global phase adds a sense of forward motion tied to playback
          const phase = (sweep * Math.PI * 2);

          const w1 = Math.sin(10 * r - t * 3.0 + phase * 0.6);
          const w2 = Math.sin(8 * (Math.cos(a*2) * r) - t * 2.2 + gx * 0.08 + phase * 0.4);
          const w3 = Math.sin(12 * (Math.sin(a*3) * r) - t * 1.4 + gy * 0.06 + phase * 0.25);

          const mix = (w1 * 0.5 + w2 * 0.3 + w3 * 0.2);
          const amp = playing ? (0.55 + intensity * 0.6) : (0.35 + intensity * 0.2);
          let v = clamp01(0.5 + mix * amp);

          // Add a subtle sweeping band that follows progress across the grid columns
          // It softly boosts tiles near the current sweep column
          const distToSweep = Math.abs(gx - sweepCol);
          const sweepBoost = Math.max(0, 1 - distToSweep / 3); // influence ~3 cols wide
          v = clamp01(v + sweepBoost * 0.12 * (playing ? 1 : 0.6));

          // Tile draw: rounded rect dot with size and opacity from v
          // If avatar present, use its luminance and local contrast to influence size to make the portrait/logo readable
          let avatarLum = 0.5;
          let edgeBoost = 0;
          if (avatarMap) {
            const idxL = (gy * grid + gx) * 4;
            const arL = avatarMap.data[idxL];
            const agL = avatarMap.data[idxL+1];
            const abL = avatarMap.data[idxL+2];
            avatarLum = (0.2126 * arL + 0.7152 * agL + 0.0722 * abL) / 255; // 0..1
            // crude edge detection vs left/top neighbors
            const nx = Math.max(0, gx - 1);
            const ny = Math.max(0, gy - 1);
            const nIdx = (gy * grid + nx) * 4;
            const mIdx = (ny * grid + gx) * 4;
            const nl = (0.2126 * avatarMap.data[nIdx] + 0.7152 * avatarMap.data[nIdx+1] + 0.0722 * avatarMap.data[nIdx+2]) / 255;
            const ml = (0.2126 * avatarMap.data[mIdx] + 0.7152 * avatarMap.data[mIdx+1] + 0.0722 * avatarMap.data[mIdx+2]) / 255;
            edgeBoost = Math.max(Math.abs(avatarLum - nl), Math.abs(avatarLum - ml));
          }
          const dot = tile * (0.14 + v * 0.46 + (1 - avatarLum) * 0.22 + edgeBoost * 0.15);
          const rx = x - dot/2;
          const ry = y - dot/2;

          // Color strategy: if avatar available, start from avatar pixel color (so avatar drives palette),
          // then lightly boost toward theme based on v so waves add warmth
          const [r1,g1,b1] = hexToRgb(colors.base);
          const [r2,g2,b2] = hexToRgb(colors.dim);
          const baseR = r2, baseG = g2, baseB = b2;
          const hotR = r1, hotG = g1, hotB = b1;
          const colorMix = v * 0.6;
          let rr = Math.round(baseR + (hotR - baseR) * colorMix);
          let gg = Math.round(baseG + (hotG - baseG) * colorMix);
          let bb = Math.round(baseB + (hotB - baseB) * colorMix);
          if (avatarMap) {
            const idx = (gy * grid + gx) * 4;
            const ar = avatarMap.data[idx];
            const ag = avatarMap.data[idx+1];
            const ab = avatarMap.data[idx+2];
            // Use avatar as the base color and blend slightly toward theme
            const themeInfluence = (playing ? 0.25 : 0.2) * (0.2 + v * 0.8);
            rr = Math.round(ar * (1 - themeInfluence) + rr * themeInfluence);
            gg = Math.round(ag * (1 - themeInfluence) + gg * themeInfluence);
            bb = Math.round(ab * (1 - themeInfluence) + bb * themeInfluence);
          }
          context.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;

          roundRect(context, rx, ry, dot, dot, Math.min(6 * dpr, dot/3));
          context.fill();
        }
      }

      // Draw 3 finder squares themed to dominant color
      drawFinder(tile*5, tile*5); // top-left
      drawFinder(logical - tile*5, tile*5); // top-right
      drawFinder(tile*5, logical - tile*5); // bottom-left
      // Bottom-right is the branded finder with carrot logo
      drawBrandFinder(logical - tile*5, logical - tile*5);

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, dpr, grid, background, colors.base, colors.dim, playing, intensity]);

  return (
    <div className="w-full max-w-full min-w-0 flex items-center justify-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [249, 115, 22];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(Math.max(0, Math.min(255, r)))}${toHex(Math.max(0, Math.min(255, g)))}${toHex(Math.max(0, Math.min(255, b)))}`;
}

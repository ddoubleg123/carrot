"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import AudioPlayer from './AudioPlayer';
import CardVisualizer from './audio/CardVisualizer';
import { paletteFromSeed, styleFromSeed } from './audio/palettes';
import { createAnalyserFromMedia } from './audio/AudioAnalyser';

interface AudioPlayerCardProps {
  audioUrl: string;
  avatarUrl?: string | null;
  seed?: string; // use postId or userId to make gradient deterministic
  promoJingleUrl?: string; // optional 5s bookend jingle
  onAudioRef?: (el: HTMLAudioElement | null) => void;
  // DB overrides (preferred if present)
  visualSeedOverride?: string | null;
  visualStyleOverride?: 'liquid' | 'radial' | 'arc' | null;
}

// Deterministic gradient from seed
function gradientFromSeed(seed?: string) {
  const pal = paletteFromSeed(seed || '');
  return { from: pal.from, to: pal.to, css: `linear-gradient(135deg, ${pal.from}, ${pal.to})` };
}

export default function AudioPlayerCard({ audioUrl, avatarUrl, seed, promoJingleUrl, onAudioRef, visualSeedOverride, visualStyleOverride }: AudioPlayerCardProps) {
  const effectiveSeed = visualSeedOverride || seed;
  const g = useMemo(() => gradientFromSeed(effectiveSeed), [effectiveSeed]);
  // Force liquid globally for now; allow env/localStorage override
  const [forcedStyle, setForcedStyle] = useState<'liquid'|'radial'|'arc'|'auto'>('liquid');
  useEffect(() => {
    try {
      const env = (process.env.NEXT_PUBLIC_AUDIO_VIZ_STYLE || '').toLowerCase();
      if (env === 'liquid' || env === 'radial' || env === 'arc') { setForcedStyle(env as any); return; }
      const ls = (typeof window !== 'undefined') ? (localStorage.getItem('carrot_audio_field_style') || '').toLowerCase() : '';
      if (ls === 'liquid' || ls === 'radial' || ls === 'arc') { setForcedStyle(ls as any); }
    } catch {}
  }, []);
  const visStyle = useMemo(() => {
    // Highest priority: DB override
    if (visualStyleOverride) return visualStyleOverride;
    // Next: forced global style/env/LS
    if (forcedStyle && forcedStyle !== 'auto') return forcedStyle;
    // Fallback: seeded style
    return styleFromSeed(effectiveSeed);
  }, [forcedStyle, visualStyleOverride, effectiveSeed]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEndcard, setShowEndcard] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const localAnalyserRef = useRef<ReturnType<typeof createAnalyserFromMedia> | null>(null);
  const [analyserState, setAnalyserState] = useState<ReturnType<typeof createAnalyserFromMedia> | null>(null);
  const showWaveOverlay = (process.env.NEXT_PUBLIC_AUDIO_WAVEFORM ?? '0') !== '0';

  // Generate a deterministic waveform client-side so it doesn't cause SSR mismatch
  useEffect(() => {
    setIsMounted(true);
    const s = (audioUrl || '').length || 42;
    const heights: number[] = [];
    for (let i = 0; i < 24; i++) {
      const pseudo = (s + i * 9) % 100 / 100; // deterministic 0..1
      heights.push(pseudo * 38 + 10); // 10..48 px
    }
    setWaveformHeights(heights);
  }, [audioUrl]);

  return (
    <div className="relative w-full max-w-full rounded-2xl overflow-hidden border border-white/40 shadow-md">
      {/* Poster background */}
      <div className="relative h-44 sm:h-56" style={{ background: g.css }}>
        {/* Single-canvas visualizer: gradient + field + rings + avatar */}
        <div className="absolute inset-0">
          <CardVisualizer
            analyser={analyserState as any}
            style={visStyle as any}
            intensity={0.95}
            avatarSrc={avatarUrl || null}
            palette={{ from: g.from, to: g.to }}
          />
        </div>
        {/* Optional static waveform overlay (can be disabled via NEXT_PUBLIC_AUDIO_WAVEFORM=0) */}
        {isMounted && showWaveOverlay && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-5 w-[78%] sm:w-[70%]">
            <div className="rounded-xl bg-white/15 backdrop-blur-[2px] ring-1 ring-white/20 px-3 py-2">
              <div className="flex items-end justify-center gap-[3px] h-12">
                {waveformHeights.map((h, i) => (
                  <div
                    key={i}
                    className={`w-[3px] sm:w-1 rounded-full ${isPlaying ? 'bg-white/80' : 'bg-white/50'} transition-transform duration-300`}
                    style={{
                      height: `${h}px`,
                      opacity: 0.85 - (i % 7) * 0.05,
                      transform: isPlaying ? `translateY(${(i % 5) - 2}px)` : 'translateY(0px)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Endcard overlay */}
        {showEndcard && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <div className="px-3 py-1.5 rounded-full bg-white text-[#FF6A00] text-sm font-semibold shadow">Powered by CARROT</div>
          </div>
        )}
      </div>

      {/* Player controls */}
      <div className="p-4 bg-white/95 backdrop-blur-sm">
        <AudioPlayer
          audioUrl={audioUrl}
          onPlayStateChange={(p) => { setIsPlaying(p); if (p) setShowEndcard(false); }}
          onTimeUpdate={() => {}}
          showWaveform={false}
          promoJingleUrl={promoJingleUrl}
          onAudioRef={(el) => {
            try {
              // create or cleanup local analyser for hero visuals
              if (!el) {
                localAnalyserRef.current?.destroy?.();
                localAnalyserRef.current = null;
                setAnalyserState(null);
              } else {
                // Prevent double-creation for the same element across re-renders
                const marker = (el as any).dataset?.analyserAttached === '1';
                if (!marker) {
                  localAnalyserRef.current?.destroy?.();
                  const a = createAnalyserFromMedia(el);
                  localAnalyserRef.current = a;
                  setAnalyserState(a);
                  try { (el as any).dataset.analyserAttached = '1'; } catch {}
                }
              }
            } catch {}
            // forward to parent for feed avatar visuals (if provided)
            try { onAudioRef && onAudioRef(el); } catch {}
          }}
          onEnded={() => {
            setIsPlaying(false);
            setShowEndcard(true);
            // Hide endcard after 5s
            setTimeout(() => setShowEndcard(false), 5000);
          }}
        />
      </div>
    </div>
  );
}

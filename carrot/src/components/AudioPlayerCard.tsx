"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import AudioPlayer from './AudioPlayer';
import AudioHero from './audio/AudioHero';
import { createAnalyserFromMedia } from './audio/AudioAnalyser';

interface AudioPlayerCardProps {
  audioUrl: string;
  avatarUrl?: string | null;
  seed?: string; // use postId or userId to make gradient deterministic
  promoJingleUrl?: string; // optional 5s bookend jingle
  onAudioRef?: (el: HTMLAudioElement | null) => void;
}

// Deterministic gradient from seed
function gradientFromSeed(seed?: string) {
  const s = seed ? Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  // Palette based on tokens: Action Orange -> Civic Blue variants
  const variants = [
    ['#FF6A00', '#0A5AFF'],
    ['#FF8A3D', '#4C7DFF'],
    ['#FF7A1A', '#2D6BFF'],
    ['#FF6A00', '#2AA2FF'],
  ];
  const pick = variants[s % variants.length];
  return {
    from: pick[0],
    to: pick[1],
    css: `linear-gradient(135deg, ${pick[0]}, ${pick[1]})`,
  };
}

export default function AudioPlayerCard({ audioUrl, avatarUrl, seed, promoJingleUrl, onAudioRef }: AudioPlayerCardProps) {
  const g = useMemo(() => gradientFromSeed(seed), [seed]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEndcard, setShowEndcard] = useState(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const localAnalyserRef = useRef<ReturnType<typeof createAnalyserFromMedia> | null>(null);

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
    <div className="relative w-full max-w-full sm:max-w-[560px] rounded-2xl overflow-hidden border border-white/40 shadow-md">
      {/* Poster background */}
      <div className="relative h-44 sm:h-56" style={{ background: g.css }}>
        {/* AudioHero: avatar + rings + reactive radial field */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AudioHero avatarSrc={avatarUrl || null} size={96} analyser={localAnalyserRef.current as any} state={isPlaying ? 'playing' : 'paused'} />
        </div>
        {/* Integrated waveform overlay (bottom center) */}
        {isMounted && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-5 w-[78%] sm:w-[70%]">
            <div className="rounded-xl bg-white/15 backdrop-blur-[2px] ring-1 ring-white/20 px-3 py-2">
              <div className="flex items-end justify-center gap-[3px] h-12">
                {waveformHeights.map((h, i) => (
                  <div
                    key={i}
                    className={`w-[3px] sm:w-1 rounded-full ${isPlaying ? 'bg-white/80' : 'bg-white/60'} transition-all duration-300`}
                    style={{
                      height: `${h}px`,
                      opacity: 0.9 - (i % 7) * 0.05,
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
              if (!el) { localAnalyserRef.current?.destroy?.(); localAnalyserRef.current = null; }
              else { localAnalyserRef.current?.destroy?.(); localAnalyserRef.current = createAnalyserFromMedia(el); }
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

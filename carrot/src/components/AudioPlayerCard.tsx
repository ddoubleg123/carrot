"use client";

import React, { useMemo, useState } from 'react';
import AudioPlayer from './AudioPlayer';

interface AudioPlayerCardProps {
  audioUrl: string;
  avatarUrl?: string | null;
  seed?: string; // use postId or userId to make gradient deterministic
  promoJingleUrl?: string; // optional 5s bookend jingle
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

export default function AudioPlayerCard({ audioUrl, avatarUrl, seed, promoJingleUrl }: AudioPlayerCardProps) {
  const g = useMemo(() => gradientFromSeed(seed), [seed]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEndcard, setShowEndcard] = useState(false);

  return (
    <div className="relative w-full max-w-full sm:max-w-[560px] rounded-2xl overflow-hidden border border-white/40 shadow-md">
      {/* Poster background */}
      <div className="relative h-44 sm:h-56" style={{ background: g.css }}>
        {/* Breathing concentric rings on play */}
        <div className={`absolute inset-0 flex items-center justify-center transition-transform ${isPlaying ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}>
          <div className="w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute w-16 h-16 rounded-full bg-white/10" />
        </div>
        {/* Avatar with progress ring placeholder (progress ring v2) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-4 ${isPlaying ? 'ring-orange-400' : 'ring-white/70'} overflow-hidden bg-white shadow-md`}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/40" />
            )}
          </div>
        </div>
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
          showWaveform={true}
          promoJingleUrl={promoJingleUrl}
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

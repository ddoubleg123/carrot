'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  postId?: string;
  className?: string;
  initialDurationSeconds?: number; // Optional duration hint to display immediately
  onPlayStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  showWaveform?: boolean; // toggle the decorative waveform box
  promoJingleUrl?: string; // optional 5s end bookend
  onEnded?: () => void; // fires after main (and jingle if provided) fully ends
  allowBlob?: boolean; // allow playing blob: URLs (safe inside composer session)
}

// Utility function to check if duration is valid
const isValidDuration = (duration: number): boolean => {
  return Boolean(duration) && isFinite(duration) && duration > 0 && duration !== Infinity;
};

export default function AudioPlayer({ 
  audioUrl, 
  postId,
  className = "",
  initialDurationSeconds,
  onPlayStateChange,
  onTimeUpdate,
  showWaveform = true,
  promoJingleUrl,
  onEnded,
  allowBlob = false,
}: AudioPlayerProps): JSX.Element {
  console.log('🎵 AudioPlayer rendered with:', { 
    postId, 
    audioUrl: audioUrl?.substring(0, 50) + '...', 
    isBlobUrl: audioUrl?.includes('blob:'),
    isFirebaseUrl: audioUrl?.includes('firebasestorage.googleapis.com')
  });
  const isBlobUrl = typeof audioUrl === 'string' && audioUrl.startsWith('blob:');
  // Resolve Firebase Storage URLs once to a stable, playable URL
  const resolvedSrc = React.useMemo(() => {
    if (!audioUrl) return '';
    if (isBlobUrl) return allowBlob ? audioUrl : '';
    if (audioUrl.includes('firebasestorage.googleapis.com') && !audioUrl.includes('alt=media')) {
      return `${audioUrl}?alt=media`;
    }
    return audioUrl;
  }, [audioUrl, isBlobUrl, allowBlob]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const jingleRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingJingle, setIsPlayingJingle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayDuration, setDisplayDuration] = useState<string>('0:00');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Client-side only waveform heights to prevent hydration mismatch
  const [waveformHeights, setWaveformHeights] = useState<number[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Fallback: decode audio via Web Audio API to get reliable duration when metadata isn't ready
  const decodeDurationWithAudioContext = async (url: string): Promise<number | null> => {
    try {
      if (!url) return null;

      console.log('🎵 Attempting AudioContext duration decode...', url);
      const res = await fetch(url, { mode: 'cors' as RequestMode });
      if (!res.ok) {
        console.log('🎵 AudioContext decode fetch not ok:', res.status, res.statusText);
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      // Use a lightweight AudioContext for duration detection
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const audioCtx = new AudioCtx();
      try {
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const d = decoded.duration;
        if (isValidDuration(d)) {
          return d;
        }
      } finally {
        // Close if supported to free resources
        if (typeof (audioCtx as any).close === 'function') {
          try { await (audioCtx as any).close(); } catch {}
        }
      }
    } catch (e: any) {
      // Most likely CORS or decoding unsupported. Non-fatal.
      console.log('🎵 AudioContext duration decode failed (non-fatal):', e?.message || e);
    }
    return null;
  };

  // Apply duration hint immediately if valid
  useEffect(() => {
    if (typeof initialDurationSeconds === 'number' && isValidDuration(initialDurationSeconds)) {
      setDuration(initialDurationSeconds);
      setDisplayDuration(formatTime(initialDurationSeconds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDurationSeconds]);

  // Generate deterministic waveform heights on client-side only
  useEffect(() => {
    setIsMounted(true);
    // Generate deterministic heights based on audioUrl to ensure consistency
    const seed = audioUrl ? audioUrl.length : 42;
    const heights: number[] = [];
    for (let i = 0; i < 20; i++) {
      // Use a simple deterministic function instead of Math.random()
      const pseudoRandom = (seed + i * 7) % 100 / 100;
      heights.push(pseudoRandom * 40 + 10);
    }
    setWaveformHeights(heights);
  }, [audioUrl, initialDurationSeconds]);

  // Audio event handlers
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;
    const audio = audioRef.current;
    
    const updateTime = () => {
      if (audio.currentTime !== undefined && isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
        try {
          if (typeof onTimeUpdate === 'function') {
            onTimeUpdate(audio.currentTime, isFinite(audio.duration) ? audio.duration : 0);
          }
        } catch {}
      }
    };
    
    const updateDuration = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
        console.log('🎵 Audio duration detected:', audio.duration);
        setDuration(audio.duration);
        setDisplayDuration(formatTime(audio.duration));
        return true;
      } else {
        console.log('🎵 Audio duration not ready (invalid/Infinity/NaN):', audio.duration);
        // Reset to 0:00 for invalid durations
        if (audio.duration === Infinity || isNaN(audio.duration)) {
          setDuration(0);
          setDisplayDuration('0:00');
        }
        return false;
      }
    };
    
    const handleEnded = async () => {
      // When main track ends, optionally play promo jingle
      if (promoJingleUrl && jingleRef.current) {
        try {
          setIsPlaying(false);
          setIsPlayingJingle(true);
          await jingleRef.current.play();
          return; // onEnded will be fired when jingle finishes
        } catch (e) {
          // If autoplay blocked or error, just finish normally
        }
      }
      setIsPlaying(false);
      try { onPlayStateChange && onPlayStateChange(false); } catch {}
      try { onEnded && onEnded(); } catch {}
    };
    const handleLoadStart = () => setIsLoading(true);
    
    const handleCanPlay = () => {
      setIsLoading(false);
      // Force duration update when audio can play
      updateDuration();
    };
    
    // Audio metadata loaded event handler
    const handleMetadataLoaded = () => {
      const audio = audioRef.current;
      if (!audio) return;
      
      console.log('🎵 Audio metadata loaded, duration:', audio.duration);
      
      if (isValidDuration(audio.duration)) {
        setDuration(audio.duration);
        setDisplayDuration(formatTime(audio.duration));
        setIsLoading(false);
      } else {
        console.log('🎵 Audio duration not ready (invalid/Infinity/NaN):', audio.duration);
        // For blob URLs (especially converted audio), try multiple approaches
        if (audioUrl && audioUrl.startsWith('blob:')) {
          console.log('🎵 Attempting duration detection for blob URL...');
          
          // Try forcing a load and play/pause cycle to get duration
          const attemptDurationDetection = async () => {
            try {
              audio.currentTime = 0;
              await audio.play();
              await new Promise(resolve => setTimeout(resolve, 50)); // Brief play
              audio.pause();
              audio.currentTime = 0;
              
              if (isValidDuration(audio.duration)) {
                console.log('🎵 Duration detected after play/pause:', audio.duration);
                setDuration(audio.duration);
                setDisplayDuration(formatTime(audio.duration));
                setIsLoading(false);
              }
            } catch (error) {
              console.log('🎵 Play/pause duration detection failed:', error);
            }
          };
          
          // Try after a delay
          setTimeout(attemptDurationDetection, 100);
        }
        
        // Fallback: Try again after a short delay
        setTimeout(() => {
          if (audio && isValidDuration(audio.duration)) {
            setDuration(audio.duration);
            setDisplayDuration(formatTime(audio.duration));
            setIsLoading(false);
          }
        }, 500);
      }
    };
    
    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const error = target.error;
      
      // Only log meaningful errors, avoid console.error spam
      if (error && error.code && error.code !== 4 && error.message) {
        console.log('🎵 Audio loading issue:', {
          errorCode: error.code,
          errorMessage: error.message,
          audioUrl: audioUrl?.substring(0, 50) + '...',
          networkState: target.networkState,
          readyState: target.readyState
        });
      }
      // Silently handle empty errors and format errors (code 4) to avoid spam
      
      setIsLoading(false);
      // Reset duration to prevent Infinity/NaN display
      setDuration(0);
      setDisplayDuration('0:00');
    };
    
    const handleLoadedMetadata = () => {
      console.log('🎵 Audio metadata loaded, duration:', audio.duration);
      updateDuration();
    };
    
    const handleLoadedData = () => {
      console.log('🎵 Audio data loaded, duration:', audio.duration);
      updateDuration();
    };

    // Add multiple event listeners for duration detection
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);

    // Force initial duration check with multiple attempts
    let durationDetected = false;
    const checkDuration = () => {
      if (durationDetected) return; // Avoid duplicate updates
      
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        console.log('🎵 Duration check successful:', audio.duration);
        setDuration(audio.duration);
        setDisplayDuration(formatTime(audio.duration));
        durationDetected = true;
      } else {
        console.log('🎵 Duration check failed, retrying...', audio.duration);
        // Force audio to load more data
        if (audio.readyState < 2) {
          audio.load();
        }
      }
    };
    
    // Try multiple times with increasing delays for Firebase Storage URLs
    const timeoutId1 = setTimeout(checkDuration, 100);
    const timeoutId2 = setTimeout(checkDuration, 500);
    const timeoutId3 = setTimeout(checkDuration, 1000);
    const timeoutId4 = setTimeout(checkDuration, 2000);
    const timeoutId5 = setTimeout(checkDuration, 5000); // Extra attempt for slow networks

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      clearTimeout(timeoutId5);
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
    audio.removeEventListener('error', handleError);
    };
  }, []);


// Force audio reload when source changes to ensure proper metadata loading
useEffect(() => {
  if (!audioRef.current) return;
  if (!resolvedSrc) {
    setIsLoading(false);
    setDuration(0);
    setCurrentTime(0);
    setDisplayDuration('0:00');
    return;
  }
  console.log('🎵 Audio source resolved:', { src: resolvedSrc, allowBlob, isBlobUrl });
  const audio = audioRef.current;
  audio.src = resolvedSrc;
  audio.load();
  setIsLoading(true);
  setDuration(0);
  setCurrentTime(0);
  if (typeof initialDurationSeconds === 'number' && isValidDuration(initialDurationSeconds)) {
    setDuration(initialDurationSeconds);
    setDisplayDuration(formatTime(initialDurationSeconds));
    setIsLoading(false);
  }
}, [resolvedSrc, allowBlob, isBlobUrl, initialDurationSeconds]);

const togglePlayPause = async () => {
  const audio = audioRef.current;
  if (!audio) return;

  if (isPlaying) {
    audio.pause();
    setIsPlaying(false);
    try { onPlayStateChange && onPlayStateChange(false); } catch {}
  } else {
    try {
      console.log('🎵 Attempting to play audio:', {
        audioUrl: audioUrl,
        readyState: audio.readyState,
        networkState: audio.networkState,
        duration: audio.duration,
        src: audio.src
      });
      
      // If jingle is playing, stop it and restart main audio
      if (isPlayingJingle && jingleRef.current) {
        try { jingleRef.current.pause(); jingleRef.current.currentTime = 0; } catch {}
        setIsPlayingJingle(false);
      }
      await audio.play();
      setIsPlaying(true);
      try { onPlayStateChange && onPlayStateChange(true); } catch {}
    } catch (error) {
      // Use console.log instead of console.error to avoid triggering Next.js error handling
      console.log('🎵 Audio play attempt failed (this is normal):', {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        audioUrl: audioUrl,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
      setIsPlaying(false);
      try { onPlayStateChange && onPlayStateChange(false); } catch {}
      
      // If the source is invalid, try to reload it
      if (error instanceof Error && error.name === 'NotSupportedError') {
        console.log('🎵 NotSupportedError detected, attempting to reload audio source');
        audio.load();
      }
    }
  }
};

const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
  const audio = audioRef.current;
  if (!audio || !duration) return;

  const newTime = parseFloat(e.target.value);
  
  // Ensure the new time is within valid bounds
  if (newTime >= 0 && newTime <= duration) {
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }
};

const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const audio = audioRef.current;
  if (!audio) return;

  const newVolume = parseFloat(e.target.value);
  audio.volume = newVolume;
  setVolume(newVolume);
  setIsMuted(newVolume === 0);
};

const toggleMute = () => {
  const audio = audioRef.current;
  if (!audio) return;

  if (isMuted) {
    audio.volume = volume;
    setIsMuted(false);
  } else {
    audio.volume = 0;
    setIsMuted(true);
  }
};

const formatTime = (time: number) => {
  // Handle invalid time values (NaN, Infinity, negative numbers)
  if (!isFinite(time) || time < 0) {
    return '0:00';
  }
  
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

return (
  <div className={`w-full max-w-full min-w-0 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg ${className}`}>
    <audio 
      ref={audioRef} 
      src={isBlobUrl ? undefined : (audioUrl.includes('firebasestorage.googleapis.com') && !audioUrl.includes('alt=media') ? `${audioUrl}?alt=media` : audioUrl)}
      preload="metadata"
      crossOrigin="anonymous"
      onLoadStart={() => console.log('🎵 Audio load started:', audioUrl)}
      onCanPlay={() => console.log('🎵 Audio can play:', audioUrl)}
      onLoadedMetadata={() => console.log('🎵 Audio metadata loaded:', { url: audioUrl, duration: audioRef.current?.duration })}
      onLoadedData={() => console.log('🎵 Audio data loaded:', { url: audioUrl, duration: audioRef.current?.duration })}
      // Use log to avoid Next.js / next-auth error interception for harmless media errors
      onError={(e) => {
        console.log('🎵 Audio element error (non-fatal):', { url: audioUrl, error: e.currentTarget.error, networkState: e.currentTarget.networkState, readyState: e.currentTarget.readyState });
        // Try fallback URL for Firebase Storage
        if (audioUrl.includes('firebasestorage.googleapis.com') && !audioUrl.includes('alt=media')) {
          const fallbackUrl = `${audioUrl}?alt=media`;
          console.log('🎵 Trying fallback URL:', fallbackUrl);
          e.currentTarget.src = fallbackUrl;
          e.currentTarget.load();
        }
      }}
    />
    {promoJingleUrl ? (
      <audio
        ref={jingleRef}
        src={promoJingleUrl}
        preload="auto"
        onEnded={() => {
          setIsPlayingJingle(false);
          try { onEnded && onEnded(); } catch {}
        }}
      />
    ) : null}
    
    {/* Waveform Visualization Placeholder (optional) */}
    {showWaveform && (
      <div className="h-16 bg-gradient-to-r from-orange-200 to-green-200 rounded-lg mb-4 flex items-center justify-center">
        {isMounted ? (
          <div className="flex items-center space-x-1">
            {waveformHeights.map((height, i) => (
              <div
                key={i}
                className="w-1 bg-orange-500 rounded-full animate-pulse"
                style={{
                  height: `${height}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        ) : (
          // SSR placeholder - simple loading state
          <div className="flex items-center space-x-2 text-orange-600">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Loading audio...</span>
          </div>
        )}
      </div>
    )}

    {/* Audio Controls */}
    <div className="flex items-center space-x-4 mb-4">
      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        disabled={isLoading || (isBlobUrl && !allowBlob)}
        className="flex items-center justify-center w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (isBlobUrl && !allowBlob) ? (
          <Play size={20} />
        ) : (isPlaying || isPlayingJingle) ? (
          <Pause size={20} />
        ) : (
          <Play size={20} />
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={duration > 0 ? currentTime : 0}
          onChange={handleSeek}
          disabled={!duration || duration <= 0 || (isBlobUrl && !allowBlob)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
          style={{
            background: duration > 0 ? `linear-gradient(to right, #f97316 0%, #f97316 ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)` : '#e5e7eb'
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : displayDuration || '0:00'}</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-2">
        <button onClick={toggleMute} className="text-gray-600 hover:text-gray-800">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Download Button */}
      <a
        href={audioUrl}
        download
        className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Download audio"
      >
        <Download size={20} />
      </a>
    </div>

    {isBlobUrl && !allowBlob && (
      <div className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
        Audio is not available yet. If this post was saved with a temporary blob URL, it cannot be replayed after reload. Please re-upload or wait for processing.
      </div>
    )}
  </div>
);
};


'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReusableVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onError?: (error: string) => void;
  onFullscreen?: () => void;
}

export interface ReusableVideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  getCurrentTime: () => number;
  setCurrentTime: (time: number) => void;
  getDuration: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  getPaused: () => boolean;
  getVideoElement: () => HTMLVideoElement | null;
}

const ReusableVideoPlayer = forwardRef<ReusableVideoPlayerRef, ReusableVideoPlayerProps>(
  ({
    src,
    poster,
    className = '',
    controls = true,
    autoPlay = false,
    muted = false,
    loop = false,
    onPlay,
    onPause,
    onEnded,
    onTimeUpdate,
    onLoadedMetadata,
    onError,
    onFullscreen,
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(muted);
    const [showControls, setShowControls] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
            setIsPlaying(true);
            onPlay?.();
          } catch (err) {
            console.error('Failed to play video:', err);
          }
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
          onPause?.();
        }
      },
      getCurrentTime: () => currentTime,
      setCurrentTime: (time: number) => {
        if (videoRef.current && !isNaN(time) && time >= 0) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
      getDuration: () => duration,
      getVolume: () => volume,
      setVolume: (vol: number) => {
        if (videoRef.current && !isNaN(vol) && vol >= 0 && vol <= 1) {
          videoRef.current.volume = vol;
          setVolume(vol);
        }
      },
      getMuted: () => isMuted,
      setMuted: (muted: boolean) => {
        if (videoRef.current && typeof muted === 'boolean') {
          videoRef.current.muted = muted;
          setIsMuted(muted);
        }
      },
      getPaused: () => !isPlaying,
      getVideoElement: () => videoRef.current,
    }));

    // Handle video events
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadStart = () => {
        setIsLoading(true);
        setError(null);
      };

      const handleLoadedMetadata = () => {
        setDuration(video.duration);
        setIsLoading(false);
        onLoadedMetadata?.(video.duration);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        onTimeUpdate?.(video.currentTime);
      };

      const handlePlay = () => {
        setIsPlaying(true);
        onPlay?.();
      };

      const handlePause = () => {
        setIsPlaying(false);
        onPause?.();
      };

      const handleEnded = () => {
        setIsPlaying(false);
        onEnded?.();
      };

      const handleError = () => {
        setError('Failed to load video');
        setIsLoading(false);
        onError?.('Failed to load video');
      };

      const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
      };

      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('error', handleError);
      video.addEventListener('volumechange', handleVolumeChange);

      return () => {
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('error', handleError);
        video.removeEventListener('volumechange', handleVolumeChange);
      };
    }, [onPlay, onPause, onEnded, onTimeUpdate, onLoadedMetadata, onError, onFullscreen]);

    const togglePlay = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play().catch(console.error);
        }
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (videoRef.current) {
        const time = parseFloat(e.target.value);
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (videoRef.current) {
        const vol = parseFloat(e.target.value);
        videoRef.current.volume = vol;
        setVolume(vol);
        if (vol > 0 && isMuted) {
          videoRef.current.muted = false;
          setIsMuted(false);
        }
      }
    };

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleMouseEnter = () => {
      setShowControls(true);
    };

    const handleMouseLeave = () => {
      setShowControls(false);
    };

    if (error) {
      return (
        <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
          <div className="text-center text-gray-500 p-8">
            <RotateCcw size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Video unavailable</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative bg-black rounded-lg overflow-hidden ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-cover"
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          preload="metadata"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}

        {/* Custom controls */}
        {controls && (showControls || !isPlaying) && (
          <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/60 via-transparent to-transparent">
            {/* Top controls */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => {
                  // Trigger fullscreen modal instead of native fullscreen
                  if (onFullscreen) {
                    onFullscreen();
                  } else if (videoRef.current) {
                    // Fallback to native fullscreen if no modal handler
                    if (videoRef.current.requestFullscreen) {
                      videoRef.current.requestFullscreen();
                    }
                  }
                }}
              >
                <Maximize2 size={16} />
              </Button>
            </div>

            {/* Center play button */}
            {!isPlaying && (
              <div className="flex justify-center items-center">
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-16 w-16 p-0 text-white hover:bg-white/20 rounded-full"
                  onClick={togglePlay}
                >
                  <Play size={32} className="ml-1" />
                </Button>
              </div>
            )}

            {/* Bottom controls */}
            <div className="space-y-2">
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-mono min-w-[40px]">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-white text-xs font-mono min-w-[40px]">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={toggleMute}
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </Button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom slider styles */}
        <style jsx>{`
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
          }
          .slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            border: none;
          }
        `}</style>
      </div>
    );
  }
);

ReusableVideoPlayer.displayName = 'ReusableVideoPlayer';

export default ReusableVideoPlayer;

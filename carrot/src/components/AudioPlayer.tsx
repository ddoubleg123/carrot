'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Languages, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  postId?: string;
  initialTranscription?: string;
  transcriptionStatus?: string;
  onTranscriptionChange?: (transcription: { text: string; language: string; duration: number } | null) => void;
  className?: string;
  hideTranscription?: boolean; // Hide transcription display (for composer use)
}

interface TranscriptionData {
  text: string;
  language: string;
  duration: number;
}

interface TranslationData {
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
}

// Utility function to check if duration is valid
const isValidDuration = (duration: number): boolean => {
  return Boolean(duration) && isFinite(duration) && duration > 0 && duration !== Infinity;
};

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

export default function AudioPlayer({ 
  audioUrl, 
  postId,
  initialTranscription,
  transcriptionStatus,
  onTranscriptionChange,
  className = "",
  hideTranscription = false
}: AudioPlayerProps) {
  console.log('🎵 AudioPlayer rendered with:', { 
    postId, 
    audioUrl: audioUrl?.substring(0, 50) + '...', 
    isBlobUrl: audioUrl?.includes('blob:'),
    isFirebaseUrl: audioUrl?.includes('firebasestorage.googleapis.com')
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayDuration, setDisplayDuration] = useState<string>('0:00');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Transcription and translation states
  const [transcription, setTranscription] = useState<TranscriptionData | null>(
    initialTranscription ? { text: initialTranscription, language: 'auto', duration: 0 } : null
  );
  const [translation, setTranslation] = useState<TranslationData | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslationOptions, setShowTranslationOptions] = useState(false);
  const [isTranscriptionMinimized, setIsTranscriptionMinimized] = useState(false);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState('en');
  const [realTranscriptionStatus, setRealTranscriptionStatus] = useState<string | null>(null);
  const [realTranscriptionText, setRealTranscriptionText] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Audio event handlers
  useEffect(() => {
    // Suppress all audio-related console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('🎵 Audio element error') || message.includes('Audio element error')) {
        // Suppress audio element errors
        return;
      }
      originalConsoleError.apply(console, args);
    };

    if (!audioRef.current || !audioUrl) return;
    const audio = audioRef.current;
    
    const updateTime = () => {
      if (audio.currentTime !== undefined && isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
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
    
    const handleEnded = () => setIsPlaying(false);
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

  // Force audio reload when audioUrl changes to ensure proper metadata loading
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      console.log('🎵 Audio URL changed, reloading:', audioUrl);
      
      // Test if Firebase Storage URL is accessible
      if (audioUrl.includes('firebasestorage.googleapis.com')) {
        console.log('🎵 Testing Firebase Storage URL accessibility...');
        fetch(audioUrl, { method: 'HEAD' })
          .then(response => {
            console.log('🎵 Firebase Storage URL test:', {
              status: response.status,
              contentType: response.headers.get('content-type'),
              contentLength: response.headers.get('content-length'),
              accessible: response.ok
            });
          })
          .catch(error => {
            console.error('🎵 Firebase Storage URL not accessible:', error);
          });
      }
      
      const audio = audioRef.current;
      audio.load(); // Reload the audio element with new URL
      setIsLoading(true);
      setDuration(0);
      setCurrentTime(0);
      setDisplayDuration('0:00');
    }
  }, [audioUrl]);

  // Poll for transcription status if postId is provided (but skip temp IDs)
  useEffect(() => {
    console.log('🔄 AudioPlayer polling effect triggered with postId:', postId);
    
    if (!postId) {
      console.log('🔄 No postId provided, skipping transcription polling');
      return;
    }
    
    // Skip polling for temporary IDs (optimistic UI)
    if (postId.startsWith('temp-')) {
      console.log('🔄 Skipping transcription polling for temp ID:', postId);
      return;
    }
    
    console.log('🎵 Starting transcription polling for real post ID:', postId);

    let retryCount = 0;
    const maxRetries = 3;
    let pollInterval: NodeJS.Timeout | null = null;

    const pollTranscriptionStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`/api/transcribe?postId=${postId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        retryCount = 0; // Reset retry count on successful request
        
        if (response.ok) {
          const data = await response.json();
          console.log('🎵 Transcription API response:', data);
          setRealTranscriptionStatus(data.status);
          if (data.transcription) {
            setRealTranscriptionText(data.transcription);
          }
          
          // Stop polling if transcription is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        } else if (response.status === 404) {
          console.log('📝 Post not found yet, will retry...', postId);
        } else {
          console.warn(`📝 Transcription polling failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        retryCount++;
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('📝 Transcription polling timeout - will retry...');
        } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.log('📝 Network error polling transcription - will retry...');
        } else {
          console.error('📝 Error polling transcription status:', error);
        }
        
        // Stop polling after max retries
        if (retryCount >= maxRetries) {
          console.warn(`📝 Max retries (${maxRetries}) reached for transcription polling. Stopping.`);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }
    };

    // Poll immediately and then every 10 seconds (reduced frequency to avoid spam)
    pollTranscriptionStatus();
    pollInterval = setInterval(pollTranscriptionStatus, 10000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [postId]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        console.log('🎵 Attempting to play audio:', {
          audioUrl: audioUrl,
          readyState: audio.readyState,
          networkState: audio.networkState,
          duration: audio.duration,
          src: audio.src
        });
        
        await audio.play();
        setIsPlaying(true);
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

  // Check for automated transcription status
  useEffect(() => {
    if (postId && transcriptionStatus) {
      if (transcriptionStatus === 'completed' && initialTranscription) {
        setTranscription({
          text: initialTranscription,
          language: 'en',
          duration: audioRef.current?.duration || 0,
        });
      }
    }
  }, [postId, transcriptionStatus, initialTranscription]);

  // Helper function to resample audio
  const resampleAudio = (audioData: Float32Array, originalSampleRate: number, targetSampleRate: number): Float32Array => {
    if (originalSampleRate === targetSampleRate) {
      return audioData;
    }
    
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const index = i * ratio;
      const indexFloor = Math.floor(index);
      const indexCeil = Math.min(indexFloor + 1, audioData.length - 1);
      const fraction = index - indexFloor;
      
      result[i] = audioData[indexFloor] * (1 - fraction) + audioData[indexCeil] * fraction;
    }
    
    return result;
  };

  // Translation functionality
  const handleTranslate = async (targetLanguage: string) => {
    // Get transcription text from either real or legacy transcription
    const textToTranslate = realTranscriptionText || transcription?.text;
    const sourceLanguage = transcription?.language || 'auto';
    
    if (!textToTranslate || isTranslating) return;

    setIsTranslating(true);
    try {
      console.log(`🌍 Starting translation to ${targetLanguage}...`);
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToTranslate,
          targetLanguage,
          sourceLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation API returned ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Translation completed:', result);
      
      setTranslation({
        translation: result.translation,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        originalText: result.originalText
      });
      setShowTranslationOptions(false);

    } catch (error) {
      console.error('Translation error:', error);
      // Set a user-friendly error state instead of throwing
      setTranslation({
        translation: 'Translation failed. Please try again.',
        sourceLanguage: sourceLanguage,
        targetLanguage,
        originalText: textToTranslate
      });
      setShowTranslationOptions(false);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg ${className}`}>
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="metadata"
        onLoadStart={() => console.log('🎵 Audio load started:', audioUrl)}
        onCanPlay={() => console.log('🎵 Audio can play:', audioUrl)}
        onLoadedMetadata={() => console.log('🎵 Audio metadata loaded:', { url: audioUrl, duration: audioRef.current?.duration })}
        onLoadedData={() => console.log('🎵 Audio data loaded:', { url: audioUrl, duration: audioRef.current?.duration })}
        onError={(e) => console.error('🎵 Audio element error:', { url: audioUrl, error: e.currentTarget.error, networkState: e.currentTarget.networkState, readyState: e.currentTarget.readyState })}
      />
      
      {/* Waveform Visualization Placeholder */}
      <div className="h-16 bg-gradient-to-r from-orange-200 to-green-200 rounded-lg mb-4 flex items-center justify-center">
        <div className="flex items-center space-x-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-orange-500 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 40 + 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Audio Controls */}
      <div className="flex items-center space-x-4 mb-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="flex items-center justify-center w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
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
            disabled={!duration || duration <= 0}
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

      {/* Enhanced Transcription Section */}
      {!hideTranscription && (realTranscriptionStatus || transcriptionStatus || transcription) && (
        <div className="mt-4 border border-gray-200 rounded-lg bg-white shadow-sm">
          {/* Transcription Header with Status and Minimize Button */}
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
            onClick={() => setIsTranscriptionMinimized(!isTranscriptionMinimized)}
          >
            <div className="flex items-center gap-3">
              <h4 className="font-medium text-gray-800">📝 Transcription</h4>
              
              {/* Status Indicator */}
              {realTranscriptionStatus === 'pending' && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-medium">Queued</span>
                </div>
              )}
              
              {realTranscriptionStatus === 'processing' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-medium">Processing</span>
                </div>
              )}
              
              {realTranscriptionStatus === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="text-xs">✅</span>
                  <span className="text-xs font-medium">Complete</span>
                </div>
              )}
              
              {realTranscriptionStatus === 'failed' && (
                <div className="flex items-center gap-2 text-red-600">
                  <span className="text-xs">❌</span>
                  <span className="text-xs font-medium">Failed</span>
                </div>
              )}
              
              {/* Fallback status indicators */}
              {!realTranscriptionStatus && transcriptionStatus === 'pending' && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-medium">Queued</span>
                </div>
              )}
              
              {!realTranscriptionStatus && transcriptionStatus === 'failed' && (
                <div className="flex items-center gap-2 text-red-600">
                  <span className="text-xs">❌</span>
                  <span className="text-xs font-medium">Failed</span>
                </div>
              )}
              
              {!realTranscriptionStatus && transcription && transcriptionStatus === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="text-xs">✅</span>
                  <span className="text-xs font-medium">Complete</span>
                </div>
              )}
            </div>
            
            {/* Minimize/Expand Button */}
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              {isTranscriptionMinimized ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Transcription Content (Collapsible) */}
          {!isTranscriptionMinimized && (
            <div className="p-3">
              {/* Processing States */}
              {(realTranscriptionStatus === 'pending' || (!realTranscriptionStatus && transcriptionStatus === 'pending')) && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 text-yellow-700 mb-2">
                    <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Transcription Queued</span>
                  </div>
                  <p className="text-sm text-yellow-600">AI will process your speech shortly</p>
                </div>
              )}
              
              {realTranscriptionStatus === 'processing' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-medium">Transcribing Audio</span>
                  </div>
                  <p className="text-sm text-blue-600">AI is processing your speech and cleaning up grammar</p>
                </div>
              )}
              
              {/* Failed States */}
              {(realTranscriptionStatus === 'failed' || (!realTranscriptionStatus && transcriptionStatus === 'failed')) && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 text-red-700 mb-2">
                    <span className="text-lg">⚠️</span>
                    <span className="font-medium">Transcription Failed</span>
                  </div>
                  <p className="text-sm text-red-600">Unable to transcribe this audio. Please try again.</p>
                </div>
              )}
              
              {/* Completed Transcription */}
              {realTranscriptionStatus === 'completed' && realTranscriptionText && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">
                      ✨ AI Enhanced with Grammar Cleanup
                    </span>
                  </div>
                  
                  {/* Scrollable Transcription Text */}
                  <div 
                    className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed max-h-40 overflow-y-auto border border-gray-200"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f9fafb' }}
                  >
                    <p className="whitespace-pre-wrap">{realTranscriptionText}</p>
                  </div>
                  
                  {/* Translation Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Languages size={16} />
                        Translate
                      </h5>
                      
                      {!showTranslationOptions && (
                        <button
                          onClick={() => setShowTranslationOptions(true)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full transition-colors"
                        >
                          Choose Language
                        </button>
                      )}
                    </div>
                    
                    {/* Language Selection */}
                    {showTranslationOptions && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={selectedTargetLanguage}
                            onChange={(e) => setSelectedTargetLanguage(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {SUPPORTED_LANGUAGES.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                          
                          <button
                            onClick={() => handleTranslate(selectedTargetLanguage)}
                            disabled={isTranslating}
                            className="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-1 rounded transition-colors"
                          >
                            {isTranslating ? 'Translating...' : 'Translate'}
                          </button>
                          
                          <button
                            onClick={() => setShowTranslationOptions(false)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Translation Result */}
                    {translation && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-blue-600 font-medium">
                            🌍 {SUPPORTED_LANGUAGES.find(l => l.code === translation.targetLanguage)?.name || translation.targetLanguage}
                          </span>
                          <button
                            onClick={() => setTranslation(null)}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            ✕
                          </button>
                        </div>
                        <div 
                          className="text-sm text-blue-800 leading-relaxed max-h-32 overflow-y-auto"
                          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f6 #dbeafe' }}
                        >
                          <p className="whitespace-pre-wrap">{translation.translation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Fallback: Legacy transcription */}
              {!realTranscriptionStatus && transcription && transcriptionStatus === 'completed' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      Language: {transcription.language}
                    </span>
                  </div>
                  
                  {/* Scrollable Transcription Text */}
                  <div 
                    className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed max-h-40 overflow-y-auto border border-gray-200"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f9fafb' }}
                  >
                    <p className="whitespace-pre-wrap">{transcription.text}</p>
                  </div>
                  
                  {/* Translation Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Languages size={16} />
                        Translate
                      </h5>
                      
                      {!showTranslationOptions && (
                        <button
                          onClick={() => setShowTranslationOptions(true)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full transition-colors"
                        >
                          Choose Language
                        </button>
                      )}
                    </div>
                    
                    {/* Language Selection */}
                    {showTranslationOptions && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={selectedTargetLanguage}
                            onChange={(e) => setSelectedTargetLanguage(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {SUPPORTED_LANGUAGES.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                          
                          <button
                            onClick={() => handleTranslate(selectedTargetLanguage)}
                            disabled={isTranslating}
                            className="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-1 rounded transition-colors"
                          >
                            {isTranslating ? 'Translating...' : 'Translate'}
                          </button>
                          
                          <button
                            onClick={() => setShowTranslationOptions(false)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Translation Result */}
                    {translation && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-blue-600 font-medium">
                            🌍 {SUPPORTED_LANGUAGES.find(l => l.code === translation.targetLanguage)?.name || translation.targetLanguage}
                          </span>
                          <button
                            onClick={() => setTranslation(null)}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            ✕
                          </button>
                        </div>
                        <div 
                          className="text-sm text-blue-800 leading-relaxed max-h-32 overflow-y-auto"
                          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f6 #dbeafe' }}
                        >
                          <p className="whitespace-pre-wrap">{translation.translation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Hidden Audio Element for Playback */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onError={(e) => {
          // Silent error handling - don't use console.error to avoid stack traces
          console.log('🎵 Audio element encountered an error (this is normal for some audio formats)');
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

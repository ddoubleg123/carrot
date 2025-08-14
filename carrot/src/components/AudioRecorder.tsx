'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Pause, Upload, X } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (audioBlob: Blob, audioUrl: string) => void;
  onCancel: () => void;
  maxDuration?: number; // in seconds
  className?: string;
}

export default function AudioRecorder({ 
  onAudioRecorded, 
  onCancel, 
  maxDuration = 300, // 5 minutes default
  className = '' 
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request microphone permission on mount
  useEffect(() => {
    requestMicrophonePermission();
    return () => {
      cleanup();
    };
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      setHasPermission(true);
      streamRef.current = stream;
      
      // Stop the stream for now, we'll request it again when recording
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setHasPermission(false);
      setError('Microphone access is required to record audio. Please allow microphone access and try again.');
    }
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please check your microphone and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        // Resume timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            const newTime = prev + 1;
            if (newTime >= maxDuration) {
              stopRecording();
            }
            return newTime;
          });
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const playRecording = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleUpload = () => {
    if (audioBlob && audioUrl) {
      onAudioRecorded(audioBlob, audioUrl);
    }
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingProgress = () => {
    return (recordingTime / maxDuration) * 100;
  };

  if (hasPermission === false) {
    return (
      <div className={`bg-white rounded-xl p-6 shadow-lg ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MicOff className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Microphone Access Required</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={requestMicrophonePermission}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-6 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Record Audio</h3>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Recording Visualization */}
      <div className="text-center mb-6">
        <div className="relative w-32 h-32 mx-auto mb-4">
          {/* Outer ring with progress */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-200">
            <div 
              className="absolute inset-0 rounded-full border-4 border-orange-500 transition-all duration-300"
              style={{
                clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((getRecordingProgress() * 3.6 - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((getRecordingProgress() * 3.6 - 90) * Math.PI / 180)}%, 50% 50%)`
              }}
            />
          </div>
          
          {/* Center button */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            {isRecording ? (
              <div className="flex items-center justify-center">
                {isPaused ? (
                  <Mic className="w-8 h-8 text-white opacity-50" />
                ) : (
                  <div className="w-6 h-6 bg-white rounded-full animate-pulse" />
                )}
              </div>
            ) : audioUrl ? (
              <Play className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </div>
        </div>

        {/* Timer */}
        <div className="text-2xl font-mono font-bold text-gray-800 mb-2">
          {formatTime(recordingTime)}
        </div>
        <div className="text-sm text-gray-500">
          Max: {formatTime(maxDuration)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center space-x-4 mb-6">
        {!isRecording && !audioUrl && (
          <button
            onClick={startRecording}
            className="flex items-center space-x-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            <Mic size={20} />
            <span>Start Recording</span>
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={pauseRecording}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
            >
              {isPaused ? <Mic size={16} /> : <Pause size={16} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <Square size={16} />
              <span>Stop</span>
            </button>
          </>
        )}

        {audioUrl && (
          <button
            onClick={playRecording}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
        )}
      </div>

      {/* Action Buttons */}
      {audioUrl && (
        <div className="flex space-x-3 justify-center">
          <button
            onClick={handleUpload}
            className="flex items-center space-x-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            <Upload size={20} />
            <span>Use Recording</span>
          </button>
          <button
            onClick={() => {
              setAudioUrl(null);
              setAudioBlob(null);
              setRecordingTime(0);
              setIsPlaying(false);
            }}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
          >
            Record Again
          </button>
        </div>
      )}

      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

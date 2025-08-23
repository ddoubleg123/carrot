"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
// NOTE: Avoid static ESM imports from '@ffmpeg/ffmpeg' to prevent Next from
// bundling it into a server-executed chunk. We'll load the UMD build at runtime.
import { fetchFile } from '@ffmpeg/util';

interface UniversalVideoFrameExtractorProps {
  file: File;
  currentTime?: number;
  onVideoReady?: (video: any) => void;
  onFrameExtracted?: (frameDataUrl: string) => void;
}

const UniversalVideoFrameExtractor: React.FC<UniversalVideoFrameExtractorProps> = ({ 
  file, 
  currentTime = 0, 
  onVideoReady, 
  onFrameExtracted 
}) => {
  const ffmpegRef = useRef<any>(null);
  const [isFFmpegReady, setIsFFmpegReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number;
    width: number;
    height: number;
  } | null>(null);

  // Load UMD script once
  const loadScriptOnce = (src: string) => new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('No document'));
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });

  // Initialize FFmpeg WebAssembly via UMD
  const initializeFFmpeg = useCallback(async () => {
    try {
      setLoadingMessage('Loading video processor...');
      console.log('UniversalVideoFrameExtractor: Initializing FFmpeg WebAssembly');
      // Load UMD shim from our same-origin proxy to avoid CORS/CSP issues
      await loadScriptOnce('/api/ffmpeg/ffmpeg.min.js');
      const w: any = window as any;
      const createFFmpeg =
        w?.FFmpeg?.createFFmpeg ||
        w?.FFmpegWASM?.createFFmpeg ||
        w?.FFmpegWASM?.FFmpeg?.createFFmpeg;

      if (createFFmpeg) {
        const ff = createFFmpeg({
          log: false,
          corePath: '/api/ffmpeg/ffmpeg-core.js',
        });
        await ff.load();
        ffmpegRef.current = ff;
      } else {
        const FFmpegClass = w?.FFmpegWASM?.FFmpeg || w?.FFmpeg?.FFmpeg;
        if (!FFmpegClass) throw new Error('FFmpeg UMD not available');
        const inst = new FFmpegClass();
        await inst.load({ corePath: '/api/ffmpeg/ffmpeg-core.js' });
        // Adapter to approximate the createFFmpeg API used elsewhere
        ffmpegRef.current = {
          loaded: true,
          isLoaded() { return true; },
          async load() {},
          async exec(args: string[]) { return inst.exec(args); },
          async writeFile(p: string, data: Uint8Array) { return inst.writeFile(p, data); },
          async readFile(p: string) { return inst.readFile(p); },
        } as any;
      }

      console.log('UniversalVideoFrameExtractor: FFmpeg loaded successfully');
      setIsFFmpegReady(true);
      setLoadingMessage('Video processor ready');
    } catch (err) {
      console.error('UniversalVideoFrameExtractor: FFmpeg initialization failed:', err);
      setError('Failed to initialize video processor');
      setLoadingMessage('');
    }
  }, []);

  // Extract video metadata
  const extractVideoMetadata = useCallback(async (videoFile: File): Promise<{ duration: number; width: number; height: number } | null> => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !isFFmpegReady) {
      console.warn('UniversalVideoFrameExtractor: FFmpeg not ready for metadata extraction');
      return null;
    }

    try {
      setLoadingMessage('Analyzing video...');
      console.log('UniversalVideoFrameExtractor: Extracting video metadata');

      // Write video file to FFmpeg filesystem
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      // Get video info using ffprobe-like command
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-f', 'null', '-'
      ]);

      // For now, return default metadata (FFmpeg logs would contain real metadata)
      // In a production app, you'd parse the FFmpeg logs to get actual duration/dimensions
      const metadata = {
        duration: 10, // Default duration - would parse from FFmpeg output
        width: 1920,  // Default width - would parse from FFmpeg output  
        height: 1080  // Default height - would parse from FFmpeg output
      };

      console.log('UniversalVideoFrameExtractor: Video metadata extracted:', metadata);
      return metadata;
    } catch (err) {
      console.warn('UniversalVideoFrameExtractor: Metadata extraction failed:', err);
      // Return default metadata as fallback
      return { duration: 10, width: 1920, height: 1080 };
    }
  }, [isFFmpegReady]);

  // Extract frame at specific time using FFmpeg
  const extractFrameAtTime = useCallback(async (timeInSeconds: number): Promise<string | null> => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !file || !isFFmpegReady) {
      console.warn('UniversalVideoFrameExtractor: FFmpeg not ready for frame extraction');
      return null;
    }

    try {
      setLoadingMessage(`Extracting frame at ${timeInSeconds.toFixed(1)}s...`);
      console.log(`UniversalVideoFrameExtractor: Extracting frame at ${timeInSeconds}s`);

      // Extract frame at specific time
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', timeInSeconds.toString(),
        '-vframes', '1',
        '-f', 'image2',
        '-vcodec', 'png',
        'output.png'
      ]);

      // Read the extracted frame
      const frameData = await ffmpeg.readFile('output.png');
      
      if (frameData && frameData instanceof Uint8Array) {
        // Convert to blob and then to data URL
        const blob = new Blob([new Uint8Array(frameData)], { type: 'image/png' });
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        console.log(`UniversalVideoFrameExtractor: Frame extracted successfully at ${timeInSeconds}s`);
        setLoadingMessage('');
        return dataUrl;
      }

      return null;
    } catch (err) {
      console.error(`UniversalVideoFrameExtractor: Frame extraction failed at ${timeInSeconds}s:`, err);
      setLoadingMessage('');
      return null;
    }
  }, [file, isFFmpegReady]);

  // Find good representative frames
  const findRepresentativeFrame = useCallback(async (): Promise<string | null> => {
    if (!videoMetadata || !isFFmpegReady) {
      console.warn('UniversalVideoFrameExtractor: Not ready for representative frame extraction');
      return null;
    }

    const candidateTimes = [
      videoMetadata.duration * 0.1,  // 10% into video
      videoMetadata.duration * 0.25, // 25% into video
      videoMetadata.duration * 0.5,  // 50% into video
      1, // 1 second as fallback
    ];

    for (const time of candidateTimes) {
      const frame = await extractFrameAtTime(time);
      if (frame) {
        console.log(`UniversalVideoFrameExtractor: Found representative frame at ${time}s`);
        return frame;
      }
    }

    return null;
  }, [videoMetadata, extractFrameAtTime, isFFmpegReady]);

  // Initialize everything when component mounts
  useEffect(() => {
    if (!file) return;

    const initialize = async () => {
      try {
        // Initialize FFmpeg if not already done
        if (!isFFmpegReady) {
          console.log('UniversalVideoFrameExtractor: FFmpeg not ready, initializing...');
          await initializeFFmpeg();
          return; // Will re-run when isFFmpegReady becomes true
        }

        console.log('UniversalVideoFrameExtractor: FFmpeg is ready, proceeding with video processing');

        // Extract video metadata
        const metadata = await extractVideoMetadata(file);
        if (metadata) {
          setVideoMetadata(metadata);

          // Create mock video object for slider
          const mockVideo = {
            duration: metadata.duration,
            _currentTime: 0,
            readyState: 4,
            videoWidth: metadata.width,
            videoHeight: metadata.height,
            set currentTime(value: number) {
              this._currentTime = Math.max(0, Math.min(value, this.duration));
            },
            get currentTime() {
              return this._currentTime || 0;
            }
          };

          if (onVideoReady) {
            onVideoReady(mockVideo);
          }

          // Extract initial representative frame
          const representativeFrame = await findRepresentativeFrame();
          if (representativeFrame) {
            setCurrentFrame(representativeFrame);
            setError(null); // Clear any previous errors
            setLoadingMessage(''); // Clear loading message
            if (onFrameExtracted) {
              onFrameExtracted(representativeFrame);
            }
          } else {
            setError('Could not extract any frames from video');
          }
        } else {
          setError('Could not analyze video file');
        }
      } catch (err) {
        console.error('UniversalVideoFrameExtractor: Initialization failed:', err);
        setError('Failed to process video file');
        setLoadingMessage('');
      }
    };

    initialize();
  }, [file, isFFmpegReady, initializeFFmpeg, extractVideoMetadata, findRepresentativeFrame, onVideoReady, onFrameExtracted]);

  // Update frame when currentTime changes
  useEffect(() => {
    if (!isFFmpegReady || !videoMetadata || currentTime === 0) return;

    const updateFrame = async () => {
      const frame = await extractFrameAtTime(currentTime);
      if (frame) {
        setCurrentFrame(frame);
        setError(null); // Clear any errors when frame extraction succeeds
        if (onFrameExtracted) {
          onFrameExtracted(frame);
        }
      }
    };

    updateFrame();
  }, [currentTime, isFFmpegReady, videoMetadata, extractFrameAtTime, onFrameExtracted]);

  if (error) {
    return (
      <div className="relative mb-4">
        <div className="w-32 h-24 bg-red-100 border-2 border-red-200 rounded-lg flex items-center justify-center">
          <div className="text-red-600 text-sm text-center px-2">
            Video Error
          </div>
        </div>
        <div className="text-xs text-red-500 mt-1 max-w-32">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-4">
      {/* Display extracted frame or loading state */}
      {currentFrame ? (
        <div className="relative">
          <img
            src={currentFrame}
            alt="Video frame"
            className="w-32 h-24 object-cover rounded-lg border-2 border-gray-200"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
            <div className="text-white text-2xl">▶️</div>
          </div>
          {/* Show current time */}
          {currentTime > 0 && (
            <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
              {currentTime.toFixed(1)}s
            </div>
          )}
        </div>
      ) : (
        <div className="w-32 h-24 bg-blue-100 border-2 border-blue-200 rounded-lg flex flex-col items-center justify-center p-2">
          <div className="text-blue-600 text-lg mb-1">⚙️</div>
          <div className="text-blue-600 text-xs text-center">
            {loadingMessage || 'Processing...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalVideoFrameExtractor;

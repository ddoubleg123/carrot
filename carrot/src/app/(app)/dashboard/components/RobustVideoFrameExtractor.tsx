import React, { useEffect, useRef, useState, useCallback } from 'react';

interface RobustVideoFrameExtractorProps {
  file: File;
  currentTime?: number;
  onVideoReady?: (video: any) => void;
  onFrameExtracted?: (frameDataUrl: string) => void;
}

const RobustVideoFrameExtractor: React.FC<RobustVideoFrameExtractorProps> = ({ 
  file, 
  currentTime = 0, 
  onVideoReady, 
  onFrameExtracted 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processing video...');
  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number;
    width: number;
    height: number;
  } | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [loadingFailed, setLoadingFailed] = useState(false);

  // Extract frame from video element using canvas
  const extractFrameFromVideo = useCallback((video: HTMLVideoElement): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to data URL
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log('RobustVideoFrameExtractor: Frame extracted successfully');
      return frameDataUrl;
    } catch (err) {
      console.error('RobustVideoFrameExtractor: Canvas extraction failed:', err);
      return null;
    }
  }, []);

  // Try multiple video loading strategies
  const initializeVideo = useCallback(async () => {
    if (!file) return;

    console.log('RobustVideoFrameExtractor: Initializing video with multiple strategies');
    setLoadingMessage('Loading video...');
    setError(null);

    const video = videoRef.current;
    if (!video) return;

    let blobUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    const tryLoadVideo = async (strategy: number): Promise<boolean> => {
      return new Promise((resolve) => {
        attempts++;
        console.log(`RobustVideoFrameExtractor: Attempt ${attempts}/${maxAttempts} (Strategy ${strategy})`);

        const cleanup = () => {
          video.removeEventListener('loadedmetadata', handleSuccess);
          video.removeEventListener('error', handleError);
          video.removeEventListener('canplay', handleCanPlay);
        };

        const handleSuccess = () => {
          console.log('RobustVideoFrameExtractor: Video loaded successfully:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          });

          if (video.duration > 0 && !isNaN(video.duration) && video.videoWidth > 0) {
            setVideoMetadata({
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight
            });

            // Create mock video object for slider
            const mockVideo = {
              duration: video.duration,
              _currentTime: 0,
              readyState: 4,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
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

            setIsVideoReady(true);
            cleanup();
            resolve(true);
          } else {
            cleanup();
            resolve(false);
          }
        };

        const handleCanPlay = () => {
          // Try to extract a frame when video can play
          setTimeout(() => {
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
              const frame = extractFrameFromVideo(video);
              if (frame) {
                setCurrentFrame(frame);
                setLoadingMessage('');
                if (onFrameExtracted) {
                  onFrameExtracted(frame);
                }
              }
            }
          }, 100);
        };

        const handleError = (e: Event) => {
          console.warn(`RobustVideoFrameExtractor: Strategy ${strategy} failed:`, {
            error: video.error,
            code: video.error?.code,
            message: video.error?.message,
            networkState: video.networkState,
            readyState: video.readyState
          });
          cleanup();
          resolve(false);
        };

        // Set up event listeners
        video.addEventListener('loadedmetadata', handleSuccess);
        video.addEventListener('error', handleError);
        video.addEventListener('canplay', handleCanPlay);

        // Configure video based on strategy
        video.muted = true;
        video.playsInline = true;
        
        switch (strategy) {
          case 1:
            video.preload = 'metadata';
            video.crossOrigin = 'anonymous';
            break;
          case 2:
            video.preload = 'auto';
            video.removeAttribute('crossOrigin');
            break;
          case 3:
            video.preload = 'none';
            video.removeAttribute('crossOrigin');
            break;
        }

        // Set source and load
        video.src = blobUrl!;
        video.load();

        // Timeout after 5 seconds
        setTimeout(() => {
          if (video.readyState === 0) {
            cleanup();
            resolve(false);
          }
        }, 5000);
      });
    };

    try {
      // Create blob URL
      blobUrl = URL.createObjectURL(file);
      console.log('RobustVideoFrameExtractor: Created blob URL:', blobUrl);

      // Try different loading strategies
      for (let strategy = 1; strategy <= maxAttempts; strategy++) {
        const success = await tryLoadVideo(strategy);
        if (success) {
          console.log(`RobustVideoFrameExtractor: Success with strategy ${strategy}`);
          return;
        }
        
        if (strategy < maxAttempts) {
          setLoadingMessage(`Trying alternative method (${strategy + 1}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
        }
      }

      // All strategies failed - show fallback
      console.warn('RobustVideoFrameExtractor: All loading strategies failed, showing fallback');
      setLoadingFailed(true);
      setLoadingMessage('');
      
      // Still create a mock video for slider functionality
      const fallbackVideo = {
        duration: 10,
        _currentTime: 0,
        readyState: 4,
        videoWidth: 1920,
        videoHeight: 1080,
        set currentTime(value: number) {
          this._currentTime = Math.max(0, Math.min(value, this.duration));
        },
        get currentTime() {
          return this._currentTime || 0;
        }
      };

      if (onVideoReady) {
        onVideoReady(fallbackVideo);
      }

    } catch (err) {
      console.error('RobustVideoFrameExtractor: Initialization failed:', err);
      setError('Failed to process video file');
      setLoadingMessage('');
    } finally {
      if (blobUrl) {
        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl!), 10000);
      }
    }
  }, [file, extractFrameFromVideo, onVideoReady, onFrameExtracted]);

  // Extract frame at specific time
  const extractFrameAtTime = useCallback(async (timeInSeconds: number) => {
    const video = videoRef.current;
    if (!video || !isVideoReady || !videoMetadata) return;

    return new Promise<void>((resolve) => {
      const handleSeeked = () => {
        const frame = extractFrameFromVideo(video);
        if (frame) {
          setCurrentFrame(frame);
          if (onFrameExtracted) {
            onFrameExtracted(frame);
          }
        }
        video.removeEventListener('seeked', handleSeeked);
        resolve();
      };

      video.addEventListener('seeked', handleSeeked);
      video.currentTime = Math.max(0, Math.min(timeInSeconds, videoMetadata.duration));
    });
  }, [isVideoReady, videoMetadata, extractFrameFromVideo, onFrameExtracted]);

  // Initialize video when component mounts
  useEffect(() => {
    initializeVideo();
  }, [initializeVideo]);

  // Update frame when currentTime changes
  useEffect(() => {
    if (currentTime > 0 && isVideoReady) {
      extractFrameAtTime(currentTime);
    }
  }, [currentTime, isVideoReady, extractFrameAtTime]);

  if (loadingFailed) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg flex flex-col items-center justify-center text-gray-700 border-2 border-green-200">
        <div className="text-4xl mb-2">✅</div>
        <div className="text-sm text-center font-medium">
          <div className="text-green-700">Video uploaded successfully!</div>
          <div className="text-xs text-gray-500 mt-1">
            Preview unavailable (unsupported codec)
          </div>
          <div className="text-xs text-blue-600 mt-2">
            📁 {file.name}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative mb-4">
        <div className="w-32 h-24 bg-yellow-100 border-2 border-yellow-200 rounded-lg flex flex-col items-center justify-center p-2">
          <div className="text-yellow-600 text-lg mb-1">🎬</div>
          <div className="text-yellow-600 text-xs text-center">
            Preview unavailable
          </div>
        </div>
        <div className="text-xs text-yellow-600 mt-1 max-w-32 text-center">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-4">
      {/* Hidden video element for processing */}
      <video
        ref={videoRef}
        className="hidden"
        muted
        playsInline
      />
      
      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />
      
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
            {loadingMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default RobustVideoFrameExtractor;

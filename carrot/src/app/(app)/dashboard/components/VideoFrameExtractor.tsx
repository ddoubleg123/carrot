import React, { useEffect, useRef, useState, useCallback } from 'react';

interface VideoFrameExtractorProps {
  file: File;
  currentTime?: number;
  onVideoReady?: (video: HTMLVideoElement) => void;
  onFrameExtracted?: (frameDataUrl: string) => void;
}

const VideoFrameExtractor: React.FC<VideoFrameExtractorProps> = ({ 
  file, 
  currentTime = 0, 
  onVideoReady, 
  onFrameExtracted 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<{
    duration: number;
    width: number;
    height: number;
  } | null>(null);

  // Extract frame at specific time
  const extractFrame = useCallback((video: HTMLVideoElement, timeInSeconds: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error('Canvas not available'));
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const handleSeeked = () => {
        try {
          // Draw current video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert to data URL
          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          console.log(`VideoFrameExtractor: Extracted frame at ${timeInSeconds}s`);
          resolve(frameDataUrl);
        } catch (err) {
          console.error('VideoFrameExtractor: Frame extraction failed:', err);
          reject(err);
        } finally {
          video.removeEventListener('seeked', handleSeeked);
        }
      };

      video.addEventListener('seeked', handleSeeked);
      video.currentTime = timeInSeconds;
    });
  }, []);

  // Find a good representative frame (avoid black/empty frames)
  const findRepresentativeFrame = useCallback(async (video: HTMLVideoElement): Promise<string> => {
    const duration = video.duration;
    const candidateTimes = [
      duration * 0.1,  // 10% into video
      duration * 0.25, // 25% into video
      duration * 0.5,  // 50% into video
      duration * 0.75, // 75% into video
    ];

    for (const time of candidateTimes) {
      try {
        const frameDataUrl = await extractFrame(video, time);
        
        // Simple check: if frame is not mostly black, use it
        // (In a more sophisticated implementation, we could analyze pixel brightness)
        if (frameDataUrl && frameDataUrl.length > 5000) { // Rough heuristic for non-empty frame
          console.log(`VideoFrameExtractor: Found representative frame at ${time}s`);
          return frameDataUrl;
        }
      } catch (err) {
        console.warn(`VideoFrameExtractor: Failed to extract frame at ${time}s:`, err);
      }
    }

    // Fallback: try to extract frame at 1 second
    try {
      return await extractFrame(video, Math.min(1, duration * 0.1));
    } catch (err) {
      throw new Error('Could not find any usable frame');
    }
  }, [extractFrame]);

  // Initialize video with multiple loading strategies
  useEffect(() => {
    if (!file) return;

    console.log('VideoFrameExtractor: Initializing video for frame extraction:', file.name);
    
    const video = videoRef.current;
    if (!video) return;

    let blobUrl: string | null = null;
    let cleanup = false;

    const initializeVideo = async () => {
      try {
        // Strategy 1: Create blob URL
        blobUrl = URL.createObjectURL(file);
        console.log('VideoFrameExtractor: Created blob URL:', blobUrl);

        const handleLoadedMetadata = async () => {
          if (cleanup) return;
          
          console.log('VideoFrameExtractor: Video metadata loaded:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          });

          if (video.duration > 0 && !isNaN(video.duration)) {
            setVideoMetadata({
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight
            });

            try {
              // Find and extract a good representative frame
              const representativeFrame = await findRepresentativeFrame(video);
              setCurrentFrame(representativeFrame);
              setIsVideoReady(true);
              setError(null);

              if (onFrameExtracted) {
                onFrameExtracted(representativeFrame);
              }

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
                onVideoReady(mockVideo as any);
              }

            } catch (frameError) {
              console.error('VideoFrameExtractor: Frame extraction failed:', frameError);
              setError('Could not extract video frames');
            }
          } else {
            setError('Video duration not available');
          }
        };

        const handleError = (e: Event) => {
          if (cleanup) return;
          
          console.error('VideoFrameExtractor: Video loading error:', {
            error: video.error,
            code: video.error?.code,
            message: video.error?.message,
            networkState: video.networkState,
            readyState: video.readyState
          });
          setError(`Video loading failed: ${video.error?.message || 'Unknown error'}`);
        };

        // Set up event listeners
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleError);

        // Configure video element
        video.muted = true;
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous';
        
        // Load the video
        video.src = blobUrl;
        video.load();

      } catch (err) {
        if (!cleanup) {
          console.error('VideoFrameExtractor: Initialization failed:', err);
          setError('Failed to initialize video');
        }
      }
    };

    initializeVideo();

    // Cleanup function
    return () => {
      cleanup = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      if (video) {
        video.removeEventListener('loadedmetadata', () => {});
        video.removeEventListener('error', () => {});
        video.src = '';
      }
    };
  }, [file, onVideoReady, onFrameExtracted, findRepresentativeFrame]);

  // Update frame when currentTime changes
  useEffect(() => {
    if (!isVideoReady || !videoMetadata || currentTime === 0) return;

    const video = videoRef.current;
    if (!video) return;

    const updateFrame = async () => {
      try {
        const frameDataUrl = await extractFrame(video, currentTime);
        setCurrentFrame(frameDataUrl);
        
        if (onFrameExtracted) {
          onFrameExtracted(frameDataUrl);
        }
      } catch (err) {
        console.warn('VideoFrameExtractor: Failed to update frame:', err);
      }
    };

    updateFrame();
  }, [currentTime, isVideoReady, videoMetadata, extractFrame, onFrameExtracted]);

  if (error) {
    return (
      <div className="relative mb-4">
        <div className="w-32 h-24 bg-red-100 border-2 border-red-200 rounded-lg flex items-center justify-center">
          <div className="text-red-600 text-sm text-center px-2">
            Frame Error
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
      {/* Hidden video element for processing */}
      <video
        ref={videoRef}
        className="hidden"
        muted
        preload="metadata"
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
        <div className="w-32 h-24 bg-gray-100 border-2 border-gray-200 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 text-sm">Extracting...</div>
        </div>
      )}
    </div>
  );
};

export default VideoFrameExtractor;

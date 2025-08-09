import React, { useEffect, useRef, useState } from 'react';

interface VideoThumbnailProps {
  file: File;
  onVideoReady?: (mockVideo: any) => void;
  currentTime?: number;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ file, onVideoReady, currentTime = 0 }) => {
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    if (!file) return;

    console.log('VideoThumbnail: Processing file (simple mode):', file.name, file.type);
    
    // Format file size
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    setFileInfo({
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type
    });

    // Create an interactive mock video object for slider functionality
    const mockVideo = {
      duration: 10, // Default 10 seconds for demo
      readyState: 4, // HAVE_ENOUGH_DATA
      videoWidth: 1920,
      videoHeight: 1080,
      _currentTime: 0,
      // Make currentTime settable
      set currentTime(value: number) {
        this._currentTime = Math.max(0, Math.min(value, this.duration));
        console.log(`Mock video currentTime set to: ${this._currentTime}`);
      },
      get currentTime() {
        return this._currentTime || 0;
      }
    };

    console.log('VideoThumbnail: Created interactive mock video for slider:', mockVideo);
    
    if (onVideoReady) {
      onVideoReady(mockVideo);
    }
  }, [file, onVideoReady]);

  return (
    <div className="relative mb-4">
      {/* Video file preview with metadata */}
      <div className="relative">
        <div className="w-32 h-24 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg flex flex-col items-center justify-center p-2">
          {/* Video icon */}
          <div className="text-blue-600 text-2xl mb-1">🎬</div>
          
          {/* File info */}
          {fileInfo && (
            <div className="text-center">
              <div className="text-xs text-gray-600 font-medium truncate max-w-28">
                {fileInfo.name.split('.')[0].substring(0, 10)}...
              </div>
              <div className="text-xs text-gray-500">
                {fileInfo.size}
              </div>
              {/* Show current time if scrubbing */}
              {currentTime > 0 && (
                <div className="text-xs text-blue-600 font-medium mt-1">
                  {currentTime.toFixed(1)}s
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
          <div className="text-white text-2xl">▶️</div>
        </div>
      </div>
    </div>
  );
};

export default VideoThumbnail;

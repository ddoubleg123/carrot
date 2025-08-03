import { useCallback, useEffect, useRef, useState } from 'react';

type CameraMode = 'capture' | 'review';

interface CameraCaptureProps {
  username: string;
  onCapture: (image: string) => void;
  onClose: () => void;
  aspectRatio?: number;
}

export default function CameraCapture({ 
  username, 
  onCapture, 
  onClose,
  aspectRatio = 3/4 
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<CameraMode>('capture');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start camera with basic error handling
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          aspectRatio: { ideal: aspectRatio },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setError(null);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please check permissions and try again.');
    }
  }, [aspectRatio]);

  // Stop camera and clean up
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Handle capture button click
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Create canvas to capture the frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL and update state
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
    setMode('review');
  }, [stopCamera]);

  // Handle retake button
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setMode('capture');
  }, []);

  // Start/stop camera based on mode
  useEffect(() => {
    if (mode === 'capture') {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  // Error state rendering
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/20 p-4 rounded-lg max-w-md w-full text-center">
          <p className="text-red-100 font-medium">Camera Error</p>
          <p className="text-red-200 mt-2 text-sm">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-[3/4] bg-black rounded-xl overflow-hidden">
        {mode === 'capture' ? (
          // Capture Mode
          <div className="w-full h-full flex flex-col">
            {/* Video Preview */}
            <div className="flex-1 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              
              {/* Username Overlay */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-1 rounded-md text-sm">
                {username}
              </div>
            </div>
            
            {/* Controls */}
            <div className="p-4 flex justify-center gap-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-white hover:bg-white/10 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 border-4 border-white"
                aria-label="Take photo"
              />
            </div>
          </div>
        ) : (
          // Review Mode
          <div className="w-full h-full flex flex-col">
            {/* Captured Image */}
            <div className="flex-1 relative">
              {capturedImage && (
                <img 
                  src={capturedImage} 
                  alt="Captured preview" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            
            {/* Controls */}
            <div className="p-4 flex justify-center gap-4">
              <button
                onClick={handleRetake}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
              >
                Retake
              </button>
              <button
                onClick={() => capturedImage && onCapture(capturedImage)}
                className="px-6 py-2 bg-carrot hover:bg-orange-600 text-white rounded-md"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FacingMode = 'user' | 'environment';
type CameraMode = 'capture' | 'review';

interface CameraCaptureProps {
  onClose: () => void;
  onCapture?: (imageData: string) => void;
  isOpen?: boolean;
  username?: string;
  onUsernameChange?: (username: string) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onClose,
  onCapture,
  isOpen = false,
  username = '',
  onUsernameChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [mode, setMode] = useState<CameraMode>('capture');
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Cleanup function to stop all media tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setHasStream(false);
    }
  }, []);

  // Start or restart the camera
  const startCamera = useCallback(async () => {
    if (!isOpen) return;
    
    try {
      setIsCapturing(true);
      setError(null);
      
      // Stop any existing stream
      stopStream();

      if (videoRef.current) {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode,
            width: { min: 640 },
            height: { min: 480 },
            aspectRatio: 1.33
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Check for multiple cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);

        // Set up the video stream
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(resolve).catch((err) => {
                setError('Failed to start video playback');
                console.error('Video playback error:', err);
                stopStream();
              });
            };
          }
        });
        
        setHasStream(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access the camera. Please check permissions.');
      stopStream();
    } finally {
      setIsCapturing(false);
    }
  }, [facingMode, isOpen, stopStream]);

  // Handle taking a photo
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the current frame from the video on the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert the canvas to a data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    setMode('review');
    
    // Stop the camera stream after capturing
    stopStream();
  }, [stopStream]);

  // Handle retaking a photo
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setMode('capture');
    startCamera();
  }, [startCamera]);

  // Toggle between front and back camera
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  // Handle camera start/stop when component mounts/unmounts or facingMode changes
  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Username input component
  const UsernameInput = () => (
    <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
      <input
        type="text"
        value={username}
        onChange={(e) => onUsernameChange?.(e.target.value)}
        placeholder="Enter your username"
        className="bg-white bg-opacity-90 px-4 py-2 rounded-lg text-center shadow-lg"
      />
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Hidden canvas for capturing images */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Main content */}
      <div className="flex-1 relative">
        {/* Video preview or captured image */}
        {mode === 'capture' ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          capturedImage && (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          )
        )}
        
        {/* Username input (only in capture mode) */}
        {mode === 'capture' && onUsernameChange && <UsernameInput />}
        
        {/* Error message */}
        {error && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
            <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
              {error}
            </div>
          </div>
        )}
        
        {/* Loading overlay */}
        {isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Camera controls */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6">
          {mode === 'capture' ? (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={onClose}
                className="rounded-full w-14 h-14"
                aria-label="Close camera"
              >
                <X className="w-6 h-6" />
              </Button>
              
              <Button
                onClick={handleCapture}
                disabled={!hasStream || isCapturing}
                className="bg-red-500 hover:bg-red-600 rounded-full w-16 h-16"
                aria-label="Take photo"
              >
                <Camera className="w-8 h-8" />
              </Button>
              
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleCamera}
                disabled={!hasMultipleCameras || isCapturing}
                className="rounded-full w-14 h-14"
                aria-label="Switch camera"
              >
                <RotateCw className="w-6 h-6" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleRetake}
                className="rounded-full w-14 h-14"
                aria-label="Retake photo"
              >
                <X className="w-6 h-6" />
              </Button>
              
              <Button
                onClick={() => capturedImage && onCapture?.(capturedImage)}
                disabled={!capturedImage}
                className="bg-green-500 hover:bg-green-600 rounded-full w-16 h-16"
                aria-label="Use photo"
              >
                <Check className="w-8 h-8" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;

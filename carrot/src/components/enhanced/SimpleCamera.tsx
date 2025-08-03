'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, FlipHorizontal } from 'lucide-react';

interface SimpleCameraProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  className?: string;
}

export function SimpleCamera({ onCapture, onClose, className = '' }: SimpleCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  // Start the camera
  const startCamera = async () => {
    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { exact: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setError(null);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access the camera. Please check permissions.');
    }
  };

  // Toggle between front and back camera
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw the current frame from the video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL and pass to parent
    const imageData = canvas.toDataURL('image/jpeg');
    onCapture(imageData);
  };

  // Start camera on mount and clean up on unmount
  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={startCamera}>
          <Camera className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
          style={{
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            display: 'block'
          }}
        />
        
        {/* Camera controls */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
          <Button
            variant="secondary"
            size="icon"
            onClick={toggleCamera}
            className="rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
          >
            <FlipHorizontal className="h-5 w-5" />
          </Button>
          
          <Button
            onClick={capturePhoto}
            size="icon"
            className="h-12 w-12 rounded-full bg-white hover:bg-gray-200"
          >
            <Camera className="h-6 w-6 text-black" />
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            className="rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
          >
            <CameraOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SimpleCamera;

import React, { useEffect, useRef, useState, useCallback } from 'react';

type CameraMode = 'capture' | 'review';
type CameraState = 'idle' | 'loading' | 'error' | 'ready';
type FacingMode = 'user' | 'environment';

interface CameraDevice {
  deviceId: string;
  label: string;
  facing: FacingMode;
}

interface CameraCaptureProps {
  onClose: () => void;
  isOpen?: boolean;
  onError?: (error: Error) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onClose,
  isOpen = true,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<CameraMode>('capture');
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [currentCamera, setCurrentCamera] = useState<CameraDevice | null>(null);

  // Get list of available cameras
  const getAvailableCameras = useCallback(async (): Promise<CameraDevice[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || 'Unknown Camera',
          facing: device.label?.toLowerCase().includes('back') ? 'environment' : 'user'
        }));
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return [];
    }
  }, []);

  // Switch to a specific camera
  const switchCamera = useCallback(async (deviceId: string) => {
    if (!isOpen || cameraState === 'loading') return;
    
    setCameraState('loading');
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      await setupCameraStream(stream);
      
      // Update current camera
      const cameras = await getAvailableCameras();
      const selectedCamera = cameras.find(cam => cam.deviceId === deviceId);
      if (selectedCamera) {
        setCurrentCamera(selectedCamera);
      }
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to switch camera');
      console.error('Camera switch error:', error);
      setError('Failed to switch camera');
      setCameraState('error');
      onError?.(error);
    }
  }, [isOpen, cameraState, onError, getAvailableCameras]);
  
  // Toggle between front and back cameras
  const toggleCamera = useCallback(async () => {
    if (!currentCamera || availableCameras.length < 2) return;
    
    // Find the next available camera
    const currentIndex = availableCameras.findIndex(cam => cam.deviceId === currentCamera.deviceId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    
    if (nextCamera) {
      await switchCamera(nextCamera.deviceId);
    }
  }, [currentCamera, availableCameras, switchCamera]);
  
  // Set up the camera stream
  const setupCameraStream = useCallback(async (stream: MediaStream) => {
    if (!videoRef.current) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Video element not available');
    }
    
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      if (!videoRef.current) return;
      
      const onLoadedMetadata = () => {
        videoRef.current?.play()
          .then(() => {
            console.log('Camera stream started successfully');
            setCameraState('ready');
            resolve();
          })
          .catch((err) => {
            console.error('Error playing video:', err);
            setError('Failed to start camera preview');
            setCameraState('error');
            onError?.(new Error('Failed to start camera preview'));
          });
      };
      
      videoRef.current.onloadedmetadata = onLoadedMetadata;
      
      // In case the event was already fired
      if (videoRef.current.readyState >= 2) {
        onLoadedMetadata();
      }
    });
  }, [onError]);

  // Initialize camera when component mounts or isOpen changes
  const startCamera = useCallback(async () => {
    if (!isOpen || cameraState === 'loading') return;
    
    setCameraState('loading');
    setError(null);
    
    try {
      // Get available cameras
      const cameras = await getAvailableCameras();
      setAvailableCameras(cameras);
      
      if (cameras.length === 0) {
        throw new Error('No cameras available');
      }
      
      // Try to use the last used camera or default to first available
      const preferredCamera = currentCamera || cameras[0];
      
      console.log('Attempting to access camera...');
      const constraints: MediaStreamConstraints = {
        video: { 
          deviceId: preferredCamera.deviceId ? { exact: preferredCamera.deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await setupCameraStream(stream);
      
      // Update current camera
      const selectedCamera = cameras.find(cam => cam.deviceId === stream.getVideoTracks()[0]?.getSettings().deviceId) || cameras[0];
      setCurrentCamera(selectedCamera);
      
      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Video element not available');
      }
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        if (!videoRef.current) return;
        
        const onLoadedMetadata = () => {
          videoRef.current?.play()
            .then(() => {
              console.log('Camera stream started successfully');
              setCameraState('ready');
              resolve();
            })
            .catch((err) => {
              console.error('Error playing video:', err);
              setError('Failed to start camera preview');
              setCameraState('error');
              onError?.(new Error('Failed to start camera preview'));
            });
        };
        
        videoRef.current.onloadedmetadata = onLoadedMetadata;
        
        // In case the event was already fired
        if (videoRef.current.readyState >= 2) {
          onLoadedMetadata();
        }
      });
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to access camera');
      console.error('Camera access error:', error);
      setError('Could not access camera. Please check permissions.');
      setCameraState('error');
      onError?.(error);
    }
  }, [isOpen, cameraState, onError]);
  
  // Effect to handle camera initialization and cleanup
  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    
    return () => {
      if (streamRef.current) {
        console.log('Cleaning up camera stream...');
        streamRef.current.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}`);
          track.stop();
        });
        streamRef.current = null;
      }
      setCameraState('idle');
    };
  }, [isOpen, startCamera]);
  
  // Handle retry
  const handleRetry = useCallback(() => {
    setError(null);
    setCameraState('idle');
    startCamera();
  }, [startCamera]);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current) {
      setError('Camera not ready');
      return null;
    }
    
    const video = videoRef.current;
    
    try {
      // Create a canvas with the same dimensions as the video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Draw the current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Validate image dimensions
      if (canvas.width < 100 || canvas.height < 100) {
        throw new Error('Captured image is too small');
      }
      
      // Convert to data URL
      return canvas.toDataURL('image/jpeg', 0.9);
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to capture image');
      console.error('Capture error:', error);
      setError(error.message);
      onError?.(error);
      return null;
    }
  }, [onError]);
  
  const handleCapture = useCallback(() => {
    const imageDataUrl = captureImage();
    if (imageDataUrl) {
      setCapturedImage(imageDataUrl);
      setMode('review');
      
      // Stop the camera stream to save resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [captureImage]);
  
  const handleConfirm = useCallback(() => {
    if (capturedImage) {
      // Here you would typically handle the confirmed image (e.g., upload to server)
      console.log('Image confirmed:', capturedImage);
      onClose();
    }
  }, [capturedImage, onClose]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    setMode('capture');
    // Restart the camera with the last used camera
    if (currentCamera) {
      switchCamera(currentCamera.deviceId);
    } else {
      startCamera();
    }
  }, [startCamera, currentCamera, switchCamera]);
  
  // Capture a frame when in review mode to ensure we have the latest frame
  const captureLatestFrame = useCallback(() => {
    if (mode === 'review' && capturedImage) {
      const newImageUrl = captureImage();
      if (newImageUrl) {
        setCapturedImage(newImageUrl);
      }
    }
  }, [mode, capturedImage, captureImage]);
  
  // Update the captured image when camera state changes (e.g., after switching cameras)
  useEffect(() => {
    if (mode === 'review' && cameraState === 'ready') {
      const timer = setTimeout(() => {
        captureLatestFrame();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mode, cameraState, captureLatestFrame]);
  
  // Handle device change events
  useEffect(() => {
    const handleDeviceChange = async () => {
      const cameras = await getAvailableCameras();
      setAvailableCameras(cameras);
      
      // If current camera was disconnected, switch to first available
      if (currentCamera && !cameras.some(cam => cam.deviceId === currentCamera.deviceId)) {
        if (cameras.length > 0) {
          switchCamera(cameras[0].deviceId);
        } else {
          setError('No cameras available');
          setCameraState('error');
        }
      }
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [currentCamera, getAvailableCameras, switchCamera]);

  if (!isOpen) return null;

  // Render loading state
  if (cameraState === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-white text-lg">Starting camera...</p>
      </div>
    );
  }

  // Render error state
  if (cameraState === 'error') {
    return (
      <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-6 z-50">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 w-full max-w-md">
          <p className="font-bold">Camera Error</p>
          <p>{error || 'Failed to access camera'}</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-50">
      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-xl overflow-hidden">
        {mode === 'capture' ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {cameraState === 'ready' && (
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <div className="flex items-center bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    cameraState === 'ready' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                  }`}></span>
                  <span>
                    {currentCamera 
                      ? `Camera Ready (${currentCamera.facing === 'user' ? 'Front' : 'Back'})` 
                      : 'Camera Ready'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {availableCameras.length > 1 && (
                    <button
                      onClick={toggleCamera}
                      disabled={availableCameras.length < 2}
                      className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Switch camera"
                      title={`Switch to ${currentCamera?.facing === 'user' ? 'back' : 'front'} camera`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    aria-label="Close camera"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            
            {/* Capture button overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
              <button
                onClick={handleCapture}
                disabled={cameraState !== 'ready'}
                className={`w-16 h-16 rounded-full border-4 ${
                  cameraState === 'ready'
                    ? 'bg-white border-white/80 hover:scale-105'
                    : 'bg-gray-400 border-gray-400/80 cursor-not-allowed'
                } transition-all duration-200 flex items-center justify-center`}
                aria-label="Take photo"
              >
                <div className={`w-3/4 h-3/4 rounded-full ${
                  cameraState === 'ready' ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 relative overflow-hidden">
              {capturedImage ? (
                <div className="relative w-full h-full bg-black">
                  <img
                    src={capturedImage}
                    alt="Captured preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                    <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                      Photo Captured
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <p className="text-white/70">No image captured</p>
                </div>
              )}
            </div>
            
            {/* Review mode controls */}
            <div className="bg-gradient-to-t from-black/90 to-black/80 p-4">
              <div className="flex justify-between items-center gap-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-white/80 hover:text-white transition-colors"
                  aria-label="Cancel"
                >
                  <span className="text-sm">Cancel</span>
                </button>
                
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleRetake}
                      className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
                      aria-label="Retake photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={handleConfirm}
                      className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                      aria-label="Confirm photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="w-10"></div> {/* Spacer for alignment */}
              </div>
            </div>
          </div>
        )}
        
        {/* Error message overlay */}
        {error && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm max-w-[90%] text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;

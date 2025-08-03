import { useState, useCallback, useEffect, useRef } from 'react';

export type FacingMode = 'user' | 'environment';
interface UseCameraProps {
  onError?: (error: Error) => void;
  onSuccess?: (stream: MediaStream) => void;
  aspectRatio?: number;
  preferredFacingMode?: FacingMode;
}

interface UseCameraReturn {
  stream: MediaStream | null;
  error: string | null;
  isFrontCamera: boolean;
  startCamera: (facingMode?: FacingMode) => Promise<void>;
  stopCamera: () => void;
  toggleCamera: () => Promise<void>;
  hasMultipleCameras: boolean;
}

export function useCamera({
  onError,
  onSuccess,
  aspectRatio = 3/4,
  preferredFacingMode = 'user',
}: UseCameraProps = {}): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(preferredFacingMode === 'user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for multiple cameras
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }
    };

    checkCameras();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const startCamera = useCallback(async (facingMode: FacingMode = isFrontCamera ? 'user' : 'environment') => {
    // Stop any existing stream
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { exact: facingMode },
          aspectRatio: { ideal: aspectRatio },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      // Try preferred camera first
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to any camera if preferred fails
        if (facingMode === 'environment') {
          const fallbackConstraints: MediaStreamConstraints = {
            ...constraints,
            video: {
              ...(constraints.video as MediaTrackConstraints),
              facingMode: 'user'
            }
          };
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          setIsFrontCamera(true);
        } else {
          throw err;
        }
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);
      onSuccess?.(mediaStream);
    } catch (err) {
      const error = err as Error;
      console.error('Camera error:', error);
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      onError?.(error);
      throw error;
    }
  }, [aspectRatio, isFrontCamera, onError, onSuccess, stopCamera]);

  const toggleCamera = useCallback(async () => {
    if (!hasMultipleCameras) return;
    
    const newFacingMode = isFrontCamera ? 'environment' : 'user';
    setIsFrontCamera(!isFrontCamera);
    
    try {
      await startCamera(newFacingMode);
    } catch (err) {
      // Revert on error
      setIsFrontCamera(!isFrontCamera);
      throw err;
    }
  }, [hasMultipleCameras, isFrontCamera, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    error,
    isFrontCamera,
    startCamera,
    stopCamera,
    toggleCamera,
    hasMultipleCameras,
  };
}

function getErrorMessage(error: Error): string {
  const { name } = error;
  
  switch (name) {
    case 'NotAllowedError':
      return 'Camera access was denied. Please enable camera permissions in your browser settings.';
    case 'NotFoundError':
      return 'No camera detected. Please connect a camera and try again.';
    case 'NotReadableError':
      return 'Camera is already in use by another application. Please close other applications using the camera.';
    case 'OverconstrainedError':
      return 'The requested camera mode is not available. Please try a different camera mode.';
    case 'AbortError':
      return 'Camera initialization was aborted. Please try again.';
    default:
      return 'Could not access the camera. Please check your device settings and try again.';
  }
}

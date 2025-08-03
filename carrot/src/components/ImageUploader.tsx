'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import Slider from '@mui/material/Slider';
import type { Area } from 'react-easy-crop';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Check, RotateCw, Loader2 as LucideLoader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  onSave: (blob: Blob, url: string) => Promise<void>;
  onClose?: () => void;
  initialImage?: string | null;
  aspect?: number;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

function ImageUploader({
  onSave,
  onClose,
  initialImage = null,
  aspect = 1,
  maxSizeMB = 5,
  className = '',
  disabled = false,
}: ImageUploaderProps): JSX.Element {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Initialize with initial image if provided
  useEffect(() => {
    if (initialImage) {
      setImgSrc(initialImage);
    }
    
    // Clean up on unmount
    return () => {
      stopCamera();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [initialImage]);

  // Handle file selection
  const onFileChange = async (file: File) => {
    if (!file) return false;

    // Validate file type
    if (!file.type.match('image/(jpeg|jpg|png|gif)')) {
      setError('Please upload a valid image file (JPG, PNG, or GIF)');
      return false;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${maxSizeMB}MB`);
      return false;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImgSrc(reader.result as string);
      // Only reset saved state if we're changing the image
      if (reader.result !== imgSrc) {
        setIsSaved(false);
      }
      setError(null);
    });
    reader.readAsDataURL(file);
    return true;
  };

  // Crop state
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // State for cropped area
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Handle crop complete
  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Generate cropped image
  const getCroppedImg = useCallback(
    async (src: string, crop: Area): Promise<Blob> => {
      const img = new Image();
      img.src = src;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the cropped image
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );

      // Convert to blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          0.9
        );
      });
    },
    []
  );

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoStream(stream);
        setStreamActive(true);
        setCaptured(false);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
      setStreamActive(false);
    }
  }, []);

  // --- Capture photo from camera ---
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setImgSrc(dataUrl);
    setStreamActive(false);
    setCaptured(true);
  }, []);

  // Dummy handleSave to unblock build
const handleSave = () => {};
// Fallback Loader2
const Loader2 = LucideLoader2;
// Handle save
  const savePhoto = useCallback(async () => {
    if (!imgSrc) return;

    try {
      setIsSaving(true);
      setError(null);
      
      // Convert data URL to blob
      const response = await fetch(imgSrc);
      const blob = await response.blob();
      
      // Create object URL for preview
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      
      // Call onSave with the blob and URL
      await onSave(blob, url);
      
      // Auto-close after a short delay
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving image:', err);
      setError('Failed to save image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [imgSrc, onSave, onClose]);

  // Handle file drop or selection
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      // Handle file rejections
      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        if (rejection.errors[0].code === 'file-too-large') {
          setError(`File is too large. Maximum size is ${maxSizeMB}MB`);
        } else if (rejection.errors[0].code === 'file-invalid-type') {
          setError('Invalid file type. Please upload an image file (JPEG, PNG, WEBP)');
        } else {
          setError('Failed to upload file. Please try again.');
        }
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        setImgSrc(reader.result as string);
        setError(null);
        setCaptured(true);
      };
      reader.readAsDataURL(file);
    },
    [maxSizeMB]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: false,
    disabled: disabled || isSaving || streamActive
  });

  // Reset states when image changes
  useEffect(() => {
    if (imgSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      // Don't reset isSaved here to maintain the saved state
    }
  }, [imgSrc]);
  
  // Handle reset to upload interface
  // Reset states when initialImage changes
  useEffect(() => {
    if (initialImage) {
      setImgSrc(initialImage);
      setIsSaved(false);
    } else {
      setImgSrc('');
      setIsSaved(false);
    }
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [initialImage]);

  useEffect(() => {
    if (initialImage) {
      setImgSrc(initialImage);
      setIsSaved(false);
    } else {
      setImgSrc('');
      setIsSaved(false);
    }
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [initialImage]);

  // Start camera
  // Camera mode state
  const [cameraMode, setCameraMode] = useState<'idle' | 'active' | 'captured'>('idle');

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoStream) {
      videoStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setVideoStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoStream]);

  return (
    <div className={cn('photo-uploader', className)}>
      <div {...getRootProps()} className={cn('relative flex flex-col items-center justify-center w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer transition hover:border-orange-400', isDragActive && 'border-orange-500 bg-orange-50', className)} style={{ minHeight: 256 }}>
        <input {...getInputProps()} disabled={disabled || isSaving || streamActive} />
        {!imgSrc && !streamActive && (
          <>
            <Camera className="w-12 h-12 text-gray-400 mb-2" />
            <p className="text-gray-500">Drag & drop or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP up to {maxSizeMB}MB</p>
            <Button type="button" variant="ghost" className="mt-4" disabled={disabled || isSaving} onClick={startCamera}>
              <Camera className="w-5 h-5 mr-2" /> Take Photo
            </Button>
          </>
        )}
        {imgSrc && !streamActive && (
          <div className="w-full">
            <div className="relative h-64 w-full bg-gray-100 rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
              <Cropper
                image={imgSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
                showGrid={false}
                restrictPosition={false}
                classes={{
                  containerClassName: 'bg-gray-100',
                  mediaClassName: 'object-contain',
                }}
                style={{
                  containerStyle: {
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                  },
                  cropAreaStyle: {
                    border: '2px solid rgba(255,255,255,0.8)',
                    borderRadius: '50%',
                  },
                }}
              />
            </div>
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-sm text-gray-600">Zoom</span>
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(_, value) => setZoom(Array.isArray(value) ? value[0] : value)}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 w-10 text-right">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button type="button" variant="outline" onClick={() => {
                setImgSrc('');
                setIsSaved(false);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCroppedAreaPixels(null);
              }} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button type="button" onClick={savePhoto} disabled={isSaving || (isSaved && !imgSrc) || !croppedAreaPixels} className={cn('w-32 transition-colors', isSaved ? 'bg-green-500 hover:bg-green-500 cursor-default' : 'bg-carrot hover:bg-carrot-dark', isSaved && 'opacity-100')}>
                {isSaving ? (
                  <span className="flex items-center justify-center">
                    <LucideLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </span>
                ) : isSaved ? (
                  <span className="flex items-center justify-center">
                    <Check className="h-4 w-4 mr-1" />
                    <span>Saved </span>
                  </span>
                ) : (
                  'Save Photo'
                )}
              </Button>
            </div>
          </div>
        )}
        {streamActive && (
          <div className="w-full flex flex-col items-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-64 rounded-lg object-cover bg-black" style={{ display: streamActive ? 'block' : 'none' }} />
            <div className="flex justify-end space-x-2 mt-4">
              <Button type="button" variant="outline" onClick={stopCamera} disabled={isSaving}>
                <RotateCw className="h-4 w-4 mr-1" /> Retake
              </Button>
              <Button type="button" onClick={capturePhoto} disabled={isSaving}>
                <Camera className="h-4 w-4 mr-1" /> Capture
              </Button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

    </div>
  );
}
export default ImageUploader;

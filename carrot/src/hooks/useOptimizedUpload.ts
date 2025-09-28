'use client';

import { useState, useCallback } from 'react';
import { optimizeImage, getOptimalDimensions, isSupportedImageType, formatFileSize } from '@/lib/imageOptimization';

export interface UploadProgress {
  stage: 'selecting' | 'optimizing' | 'uploading' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface OptimizedUploadResult {
  originalFile: File;
  optimizedFile: File;
  publicURL: string;
  storagePath?: string;
  optimizationStats: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    savedBytes: number;
  };
}

export function useOptimizedUpload() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(async (
    file: File,
    useCase: 'avatar' | 'post' | 'banner' | 'thumbnail' = 'post'
  ): Promise<OptimizedUploadResult | null> => {
    try {
      setIsUploading(true);
      
      // Stage 1: File validation
      setUploadProgress({
        stage: 'selecting',
        progress: 10,
        message: 'Validating file...'
      });

      if (!isSupportedImageType(file)) {
        throw new Error('Unsupported file type. Please upload JPEG, PNG, or WebP images.');
      }

      // Stage 2: Image optimization
      setUploadProgress({
        stage: 'optimizing',
        progress: 30,
        message: 'Optimizing image...'
      });

      const dimensions = getOptimalDimensions(useCase);
      const optimizationResult = await optimizeImage(file, {
        maxSizeMB: dimensions.maxSizeMB,
        maxWidthOrHeight: dimensions.maxWidthOrHeight,
        quality: dimensions.quality,
        useWebWorker: true
      });

      // Stage 3: Upload to storage
      setUploadProgress({
        stage: 'uploading',
        progress: 60,
        message: 'Uploading to storage...'
      });

      // Get presigned URL
      const presignedResponse = await fetch('/api/getPresignedURL', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: optimizationResult.optimizedFile.type,
          maxBytes: dimensions.maxSizeMB * 1024 * 1024
        })
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, publicURL, path } = await presignedResponse.json();

      // Upload optimized file
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': optimizationResult.optimizedFile.type },
        body: optimizationResult.optimizedFile
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      setUploadProgress({
        stage: 'complete',
        progress: 100,
        message: `Upload complete! Saved ${formatFileSize(optimizationResult.savedBytes)}`
      });

      return {
        originalFile: optimizationResult.originalFile,
        optimizedFile: optimizationResult.optimizedFile,
        publicURL,
        storagePath: path,
        optimizationStats: {
          originalSize: optimizationResult.originalSize,
          optimizedSize: optimizationResult.optimizedSize,
          compressionRatio: optimizationResult.compressionRatio,
          savedBytes: optimizationResult.savedBytes
        }
      };

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed'
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadMultiple = useCallback(async (
    files: File[],
    useCase: 'avatar' | 'post' | 'banner' | 'thumbnail' = 'post'
  ): Promise<OptimizedUploadResult[]> => {
    const results: OptimizedUploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({
        stage: 'uploading',
        progress: (i / files.length) * 100,
        message: `Uploading ${i + 1} of ${files.length} files...`
      });
      
      const result = await uploadFile(file, useCase);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }, [uploadFile]);

  const reset = useCallback(() => {
    setUploadProgress(null);
    setIsUploading(false);
  }, []);

  return {
    uploadFile,
    uploadMultiple,
    uploadProgress,
    isUploading,
    reset
  };
}

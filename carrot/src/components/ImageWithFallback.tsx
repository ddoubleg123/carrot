'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import type { ImageProps } from 'next/image';

interface ImageWithFallbackProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  src: string;
  alt: string;
  maxRetries?: number;
  onLoadSuccess?: () => void;
  onLoadFailure?: (error: any) => void;
  fallbackContent?: React.ReactNode;
}

export default function ImageWithFallback({
  src,
  alt,
  maxRetries = 3,
  onLoadSuccess,
  onLoadFailure,
  fallbackContent,
  ...props
}: ImageWithFallbackProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    console.log('[ImageWithFallback] ✓ Image loaded successfully:', {
      src: src.substring(0, 100),
      retryCount,
      isDataUri: src.startsWith('data:'),
      isFirebase: src.includes('firebasestorage'),
      isProxied: src.startsWith('/api/img')
    });
    onLoadSuccess?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('[ImageWithFallback] ✗ Image load error:', {
      src: src.substring(0, 100),
      retryCount,
      maxRetries,
      isDataUri: src.startsWith('data:'),
      isFirebase: src.includes('firebasestorage'),
      isProxied: src.startsWith('/api/img'),
      error: e.type
    });

    // Retry logic with exponential backoff
    if (retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      console.log(`[ImageWithFallback] Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setIsLoading(true);
        // Force image reload by adding cache-busting query param
        const img = e.currentTarget;
        if (img && img.src) {
          const separator = img.src.includes('?') ? '&' : '?';
          img.src = `${img.src}${separator}_retry=${retryCount + 1}&t=${Date.now()}`;
        }
      }, delay);
    } else {
      // Max retries reached - show fallback
      setHasError(true);
      setIsLoading(false);
      onLoadFailure?.(e);
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Show fallback if max retries exceeded
  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
        {fallbackContent || (
          <div className="text-center p-4">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Image unavailable</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
        </div>
      )}
      <Image
        {...props}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}


import imageCompression from 'browser-image-compression';

export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  useWebWorker?: boolean;
  fileType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface OptimizationResult {
  originalFile: File;
  optimizedFile: File;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  savedBytes: number;
}

/**
 * Optimizes an image file for web use
 */
export async function optimizeImage(
  file: File, 
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult> {
  const {
    maxSizeMB = 1,
    maxWidthOrHeight = 1920,
    quality = 0.85,
    useWebWorker = true,
    fileType = 'image/jpeg'
  } = options;

  // Don't optimize if already small enough
  if (file.size <= maxSizeMB * 1024 * 1024 && file.type === fileType) {
    return {
      originalFile: file,
      optimizedFile: file,
      originalSize: file.size,
      optimizedSize: file.size,
      compressionRatio: 0,
      savedBytes: 0
    };
  }

  try {
    const optimizedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
      fileType,
      initialQuality: quality,
      alwaysKeepResolution: false,
      preserveExif: false
    });

    const compressionRatio = ((file.size - optimizedFile.size) / file.size) * 100;
    const savedBytes = file.size - optimizedFile.size;

    return {
      originalFile: file,
      optimizedFile,
      originalSize: file.size,
      optimizedSize: optimizedFile.size,
      compressionRatio,
      savedBytes
    };
  } catch (error) {
    console.error('Image optimization failed:', error);
    // Return original file if optimization fails
    return {
      originalFile: file,
      optimizedFile: file,
      originalSize: file.size,
      optimizedSize: file.size,
      compressionRatio: 0,
      savedBytes: 0
    };
  }
}

/**
 * Optimizes multiple images in parallel
 */
export async function optimizeImages(
  files: File[],
  options: ImageOptimizationOptions = {}
): Promise<OptimizationResult[]> {
  const promises = files.map(file => optimizeImage(file, options));
  return Promise.all(promises);
}

/**
 * Gets optimal image dimensions for different use cases
 */
export function getOptimalDimensions(useCase: 'avatar' | 'post' | 'banner' | 'thumbnail'): {
  maxWidthOrHeight: number;
  maxSizeMB: number;
  quality: number;
} {
  switch (useCase) {
    case 'avatar':
      return { maxWidthOrHeight: 400, maxSizeMB: 0.5, quality: 0.9 };
    case 'thumbnail':
      return { maxWidthOrHeight: 300, maxSizeMB: 0.3, quality: 0.8 };
    case 'post':
      return { maxWidthOrHeight: 1920, maxSizeMB: 1, quality: 0.85 };
    case 'banner':
      return { maxWidthOrHeight: 2560, maxSizeMB: 2, quality: 0.8 };
    default:
      return { maxWidthOrHeight: 1920, maxSizeMB: 1, quality: 0.85 };
  }
}

/**
 * Validates if a file is a supported image type
 */
export function isSupportedImageType(file: File): boolean {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return supportedTypes.includes(file.type.toLowerCase());
}

/**
 * Gets file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Upload hero images to Firebase Storage
 * Handles base64 conversion and storage path management
 */

import { uploadToFirebase } from '@/lib/uploadToFirebase';
import { DISCOVERY_CONFIG } from '@/config/discovery';

export interface UploadHeroImageOptions {
  base64Image: string;
  itemId: string;
  patchHandle?: string;
  storageType?: 'discovered' | 'patches' | 'backfill';
}

/**
 * Upload a base64 hero image to Firebase Storage
 */
export async function uploadHeroImage(options: UploadHeroImageOptions): Promise<string> {
  const { base64Image, itemId, patchHandle, storageType = 'discovered' } = options;
  
  try {
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate storage path based on type
    let storagePath: string;
    
    switch (storageType) {
      case 'patches':
        if (!patchHandle) throw new Error('patchHandle required for patches storage');
        storagePath = `${DISCOVERY_CONFIG.STORAGE_PATHS.PATCHES}/${patchHandle}/hero-${itemId}.png`;
        break;
        
      case 'backfill':
        if (!patchHandle) throw new Error('patchHandle required for backfill storage');
        storagePath = `${DISCOVERY_CONFIG.STORAGE_PATHS.BACKFILL}/${patchHandle}/${itemId}.png`;
        break;
        
      case 'discovered':
      default:
        storagePath = `${DISCOVERY_CONFIG.STORAGE_PATHS.DISCOVERED}/${itemId}/hero.png`;
        break;
    }
    
    // Upload to Firebase Storage
    const firebaseUrl = await uploadToFirebase(buffer, storagePath, 'image/png');
    
    console.log(`[UploadHeroImage] ✅ Uploaded to: ${storagePath}`);
    return firebaseUrl;
    
  } catch (error) {
    console.error('[UploadHeroImage] ❌ Upload failed:', error);
    throw error;
  }
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(base64Image: string): Promise<{ width: number; height: number; valid: boolean }> {
  return new Promise((resolve) => {
    // Create an image element to get dimensions
    const img = new Image();
    
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const valid = width >= DISCOVERY_CONFIG.MIN_IMAGE_WIDTH && height >= DISCOVERY_CONFIG.MIN_IMAGE_HEIGHT;
      resolve({ width, height, valid });
    };
    
    img.onerror = () => {
      resolve({ width: 0, height: 0, valid: false });
    };
    
    img.src = base64Image;
  });
}

/**
 * Compress base64 image if too large
 */
export async function compressImageIfNeeded(base64Image: string, maxSizeKB: number = 500): Promise<string> {
  const sizeKB = (base64Image.length * 0.75) / 1024; // Approximate size in KB
  
  if (sizeKB <= maxSizeKB) {
    return base64Image; // No compression needed
  }
  
  console.log(`[UploadHeroImage] Compressing image from ${Math.round(sizeKB)}KB to ~${maxSizeKB}KB`);
  
  // TODO: Implement actual compression using sharp or similar
  // For now, just return original
  return base64Image;
}


/**
 * Firebase Storage Upload Helper
 * Handles uploading hero images to Firebase Storage
 */

import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface UploadHeroImageParams {
  base64Image: string;
  itemId: string;
  patchHandle?: string;
  storageType?: 'discovered' | 'patches' | 'backfill';
  fileName?: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a hero image to Firebase Storage
 * Supports multiple storage paths based on context
 */
export async function uploadHeroImage(
  params: UploadHeroImageParams
): Promise<string> {
  try {
    const { base64Image, itemId, patchHandle, storageType = 'discovered', fileName } = params;

    if (!storage) {
      throw new Error("Firebase Storage not initialized");
    }

    // Convert base64 to blob
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/png" });

    // Generate storage path based on type
    let storagePath: string;
    const timestamp = Date.now();
    const finalFileName = fileName || `hero-${itemId}-${timestamp}.png`;

    switch (storageType) {
      case 'discovered':
        // discovered/{itemId}/hero.png
        storagePath = `discovered/${itemId}/hero.png`;
        break;
      case 'patches':
        // patches/{patchHandle}/hero-{itemId}.png
        if (!patchHandle) {
          throw new Error("patchHandle required for 'patches' storage type");
        }
        storagePath = `patches/${patchHandle}/hero-${itemId}.png`;
        break;
      case 'backfill':
        // backfill/{patchHandle}/{itemId}.png
        if (!patchHandle) {
          throw new Error("patchHandle required for 'backfill' storage type");
        }
        storagePath = `backfill/${patchHandle}/${itemId}.png`;
        break;
      default:
        // Legacy: hero-images/{fileName}
        storagePath = `hero-images/${finalFileName}`;
    }

    console.log(`[uploadHeroImage] Uploading to: ${storagePath}`);
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log(`[uploadHeroImage] ✅ Upload successful: ${downloadURL}`);
    return downloadURL;

  } catch (error) {
    console.error("[uploadHeroImage] ❌ Error:", error);
    throw new Error(
      `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

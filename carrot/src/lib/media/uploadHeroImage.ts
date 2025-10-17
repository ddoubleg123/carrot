/**
 * Firebase Storage Upload Helper
 * Handles uploading hero images to Firebase Storage
 */

import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a hero image to Firebase Storage
 */
export async function uploadHeroImage(
  imageData: string, 
  itemId: string, 
  fileName?: string
): Promise<UploadResult> {
  try {
    if (!storage) {
      throw new Error("Firebase Storage not initialized");
    }

    // Convert base64 to blob
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/png" });

    // Generate filename
    const timestamp = Date.now();
    const finalFileName = fileName || `hero-${itemId}-${timestamp}.png`;
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, `hero-images/${finalFileName}`);
    const snapshot = await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      url: downloadURL
    };
  } catch (error) {
    console.error("[uploadHeroImage] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed"
    };
  }
}

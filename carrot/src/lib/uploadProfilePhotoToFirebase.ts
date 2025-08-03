import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

import { storage } from './firebase';


/**
 * Uploads a profile photo (File or dataURL) to Firebase Storage and returns the public download URL.
 * @param fileOrDataUrl File object or data URL string
 * @param userId string (required for pathing)
 * @returns Promise<string> download URL
 */
export async function uploadProfilePhotoToFirebase(fileOrDataUrl: File | string, userId: string): Promise<string> {
  if (!fileOrDataUrl) {
    console.error('[uploadProfilePhotoToFirebase] fileOrDataUrl is undefined or null');
    throw new Error('No file or dataUrl provided for upload');
  }
  if (!userId) {
    console.error('[uploadProfilePhotoToFirebase] userId is missing');
    throw new Error('No userId provided for upload');
  }
  let file: File;

  if (typeof fileOrDataUrl === 'string') {
    // Convert dataURL to Blob
    const res = await fetch(fileOrDataUrl);
    const blob = await res.blob();
    file = new File([blob], `profile-${uuidv4()}.jpg`, { type: 'image/jpeg' });
  } else {
    file = fileOrDataUrl;
  }

  const filePath = `profile-photos/${userId}/${uuidv4()}.jpg`;
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

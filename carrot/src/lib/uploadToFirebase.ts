import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ensureFirebaseSignedIn } from './ensureFirebaseSignedIn';

/**
 * Uploads a File to Firebase Storage and returns its download URL.
 * @param file File to upload
 * @param path Storage path (e.g. 'posts/${userId}/${timestamp}_${filename}')
 */
export async function uploadFileToFirebase(file: File, path: string): Promise<string> {
  try {
    // Ensure user is properly signed in to Firebase (fixes 403 permission errors)
    await ensureFirebaseSignedIn();
    
    console.log('Starting Firebase Storage upload:', { path, fileType: file.type, fileSize: file.size });
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Firebase Storage upload successful:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Firebase Storage upload failed:', error);
    throw error;
  }
}

/**
 * Uploads multiple files to Firebase Storage and returns their download URLs.
 * @param files Array of Files
 * @param basePath Storage base path (e.g. 'posts/${userId}/${timestamp}/')
 */
export async function uploadFilesToFirebase(files: File[], basePath: string): Promise<string[]> {
  return Promise.all(
    files.map((file, i) => {
      const path = `${basePath}${Date.now()}_${i}_${file.name}`;
      return uploadFileToFirebase(file, path);
    })
  );
}

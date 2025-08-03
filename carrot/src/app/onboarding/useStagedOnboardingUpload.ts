import React, { useState, useRef } from "react";
import { auth, storage } from '@/lib/firebase';
import type { Firestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, writeBatch, getDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, UploadTask, getDownloadURL } from "firebase/storage";
import { DraftImage, OnboardingDraft } from "./types";
import { ensureFirebaseSignedIn } from '@/lib/ensureFirebaseSignedIn';

// Hook for managing staged onboarding uploads and Firestore draft state
export function useStagedOnboardingUpload(sessionId: string, userId: string) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  // Rehydrate draft from Firestore if missing
  React.useEffect(() => {
    if (!draft && userId && sessionId) {
      const fetchDraft = async () => {
        try {
          const draftRef = doc(db, `users/${userId}/onboardingDrafts/${sessionId}`);
          const snap = await getDoc(draftRef);
          if (snap.exists()) {
            setDraft(snap.data() as OnboardingDraft);
          }
        } catch (err) {
          console.error('[useStagedOnboardingUpload] Failed to fetch onboarding draft:', err);
        }
      };
      fetchDraft();
    }
  }, [draft, userId, sessionId]);
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const canceledAssetIds = useRef<Set<string>>(new Set());


// Start a staged image upload (after Step 1 or retake)
  async function startImageUpload(file: Blob): Promise<DraftImage> {
    // Debug: log userId and Firebase Auth UID
    let firebaseUid = undefined;
    try {
      // Only import firebase/auth on client
      if (typeof window !== 'undefined') {
        await ensureFirebaseSignedIn();
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        firebaseUid = auth.currentUser?.uid;
        console.log('[useStagedOnboardingUpload] startImageUpload: userId prop:', userId, '| firebase.auth().currentUser?.uid:', firebaseUid);
        if (!firebaseUid) {
          console.error('[useStagedOnboardingUpload] ERROR: No Firebase Auth UID found! User may not be authenticated.');
        } else if (userId !== firebaseUid) {
          console.error('[useStagedOnboardingUpload] ERROR: userId does not match Firebase Auth UID!', { userId, firebaseUid });
          throw new Error('User ID mismatch: cannot upload.');
        }
      }
    } catch (err) {
      console.error('[useStagedOnboardingUpload] ERROR during Firebase Auth UID check:', err);
    }
    if (!file) {
      console.error('[useStagedOnboardingUpload] startImageUpload called with undefined file');
      throw new Error('No file provided for upload');
    }
    if (!userId) {
      console.error('[useStagedOnboardingUpload] startImageUpload called with missing userId');
      throw new Error('No user id');
    }
    if (!file) throw new Error("No file provided for upload");
    if (!userId) throw new Error("No user id");
    if (!userId) throw new Error("No user id");
    const assetId = crypto.randomUUID();
    const ext = file.type.split("/")[1] || "jpg";
    const storagePath = `users/${userId}/staged/${sessionId}/${assetId}.${ext}`;
    if (!storagePath) throw new Error("Failed to generate storage path for upload");
    // Defensive logging and validation before upload
    console.log('[startImageUpload] file:', file, 'type:', typeof file, 'file instanceof Blob:', file instanceof Blob, 'file instanceof File:', file instanceof File);
    if (!file || typeof file !== 'object' || typeof file.type !== 'string') {
      console.error('[startImageUpload] Invalid file passed to upload:', file);
      throw new Error('Invalid file passed to upload. Please try again.');
    }
    console.log('[startImageUpload] storage:', storage);
    console.log('[startImageUpload] storagePath:', storagePath);
    if (!storage) {
      console.error('[startImageUpload] Firebase storage is undefined!');
      throw new Error('Firebase storage is not initialized.');
    }
    if (!storagePath || typeof storagePath !== 'string') {
      console.error('[startImageUpload] storagePath is invalid:', storagePath);
      throw new Error('Internal error: upload path is invalid.');
    }
    const ref = storageRef(storage, storagePath);
    console.log('[startImageUpload] storageRef:', ref);
    const task = uploadBytesResumable(ref, file, {
      contentType: file.type,
      cacheControl: "public,max-age=31536000",
    });
    setUploadTask(task);
    setUploading(true);
    setUploadProgress(0);

    return new Promise<DraftImage>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100);
        },
        (err) => {
          setUploading(false);
          reject(err);
        },
        async () => {
          setUploading(false);
          if (canceledAssetIds.current.has(assetId)) {
            resolve({
              assetId,
              storagePath,
              uploadState: "canceled",
              rev: 1,
              superseded: true,
            });
            return;
          }
          resolve({
            assetId,
            storagePath,
            uploadState: "done",
            rev: 1,
          });
        }
      );
    });
  }

  // Cancel current upload (for retake)
  function cancelUpload() {
    if (uploadTask) {
      canceledAssetIds.current.add(uploadTask.snapshot.ref.name.split("/").pop()!);
      uploadTask.cancel();
      setUploadTask(null);
      setUploading(false);
    }
  }

  // Save/merge draft doc in Firestore
  // Save/merge draft doc in Firestore with robust error handling and correct timestamp usage
  async function saveDraft(draftData: Partial<OnboardingDraft>): Promise<boolean> {
    if (!userId) throw new Error("No user id");
    const draftRef = doc(db, `users/${userId}/onboardingDrafts/${sessionId}`);
    // Deep clean utility to remove undefined from all nested fields
    function cleanFirestorePayload(obj: Record<string, any>): any {
      if (obj === null || typeof obj !== 'object') return obj;
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, cleanFirestorePayload(v)])
      );
    }
    const rawDraftData = {
      ...draft,
      ...draftData,
      updatedAt: serverTimestamp(), // <-- CORRECT USAGE
    };
    const payload = cleanFirestorePayload(rawDraftData);
    console.log('💾 Draft payload to Firestore:', JSON.stringify(payload, null, 2));
    setDraft(payload as OnboardingDraft);
    try {
      await setDoc(draftRef, payload, { merge: true });
      return true; // success
    } catch (err) {
      console.error('[saveDraft] Firestore write error:', err);
      // Optionally: surface error to UI via callback, event, or state
      return false; // failed
    }
  }

  // Finalize onboarding (Step 3) - now calls Cloud Function
  async function finalizeOnboarding() {
    if (!userId) {
      console.error('[useStagedOnboardingUpload] finalizeOnboarding called with missing userId');
      throw new Error('No user id');
    }
    if (!sessionId) {
      console.error('[useStagedOnboardingUpload] finalizeOnboarding called with missing sessionId');
      throw new Error('No session id');
    }
    // Optionally: check that draft and draft.image exist before allowing finalize
    if (!draft || !draft.image || !draft.image.storagePath) {
      throw new Error('Profile photo upload incomplete. Please upload a photo before continuing.');
    }
    try {
      // Dynamically import the utility to avoid circular deps
      const { finalizeOnboardingSession } = await import('@/lib/finalizeOnboarding');
      const result = await finalizeOnboardingSession(sessionId);
      return result; // { ok: true, photoURL, photoRev }
    } catch (err) {
      console.error('[useStagedOnboardingUpload] finalizeOnboarding error:', err);
      throw err;
    }
  }

  return {
    draft,
    uploadTask,
    uploadProgress,
    uploading,
    startImageUpload,
    cancelUpload,
    saveDraft,
    finalizeOnboarding,
  };
}

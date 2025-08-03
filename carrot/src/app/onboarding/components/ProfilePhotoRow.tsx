"use client";
"use client";

import { useEffect, useRef, useState } from "react";
import CameraWithCropModal from "@/components/CameraWithCropModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

import { useOnboardingSessionId } from '../useOnboardingSessionId';
import { useStagedOnboardingUpload } from '../useStagedOnboardingUpload';

export default function ProfilePhotoRow({ avatar, onAvatarChange, userId }: { avatar: string | null, onAvatarChange: (url: string) => void, userId: string }) {
  // NEW: Preview state for instant feedback
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const sessionId = useOnboardingSessionId();
  const {
    uploadProgress,
    uploading,
    startImageUpload,
    cancelUpload,
    saveDraft,
    draft
  } = useStagedOnboardingUpload(sessionId, userId);

  const [error, setError] = useState<string | null>(null);

  // Show staged photo URL if available
  const stagedPhotoUrl = draft?.image?.storagePath ? `https://firebasestorage.googleapis.com/v0/b/YOUR_BUCKET/o/${encodeURIComponent(draft.image.storagePath)}?alt=media` : null;

  async function handlePhoto(dataUrlOrFile: string | File) {
    if (uploading) cancelUpload();
    // Defensive logging
    console.log('[ProfilePhotoRow] handlePhoto called with:', dataUrlOrFile, typeof dataUrlOrFile);
    if (dataUrlOrFile === undefined || dataUrlOrFile === null) {
      console.error('[ProfilePhotoRow] ERROR: dataUrlOrFile is undefined or null!');
      alert('No photo selected or captured.');
      return;
    }
    let file: File;
    // Show local preview immediately if possible
    if (typeof dataUrlOrFile === 'string') {
      // Convert dataURL to Blob and wrap as File
      try {
        const res = await fetch(dataUrlOrFile);
        const blob = await res.blob();
        file = new File([blob], 'profilePhoto.jpg', { type: blob.type || 'image/jpeg' });
        // Show local preview for dataURL
        const localUrl = URL.createObjectURL(blob);
        setProfilePhotoPreview(localUrl);
      } catch (err) {
        console.error('[ProfilePhotoRow] ERROR converting dataUrl to File:', err);
        alert('Failed to process photo.');
        return;
      }
    } else {
      file = dataUrlOrFile;
      // Show local preview for File
      const localUrl = URL.createObjectURL(file);
      setProfilePhotoPreview(localUrl);
      // Defensive: log file structure
      if (typeof file !== 'object' || typeof file.name !== 'string' || typeof file.type !== 'string') {
        console.error('[ProfilePhotoRow] ERROR: file object is malformed:', file);
        alert('Invalid file type.');
        return;
      }
      // Legacy .path warning
      if ('path' in file) {
        console.warn('[ProfilePhotoRow] WARNING: file has a .path property:', (file as any).path);
      }
    }
    try {
      setError(null);
      const image = await startImageUpload(file);
      // Await saveDraft and check result
      const success = await saveDraft({ image });
      if (!success) {
        setError('Couldn’t save photo to Firestore. Please try again.');
        return; // Do not close modal or proceed
      }
      // Fetch the download URL from Firebase Storage and update avatar
      try {
        const { getDownloadURL, ref: storageRef } = await import('firebase/storage');
        const storage = (await import('@/lib/firebase')).storage;
        const photoRef = storageRef(storage, image.storagePath);
        const downloadUrl = await getDownloadURL(photoRef);
        setProfilePhotoPreview(downloadUrl); // Swap to remote URL as soon as available
        onAvatarChange(downloadUrl);
        setOpen(false); // Close modal after avatar updates
      } catch (urlErr) {
        setError('Photo saved, but could not fetch image URL. Try refreshing.');
        console.error('[ProfilePhotoRow] Could not fetch download URL:', urlErr);
      }
    } catch (err) {
      console.error('[ProfilePhotoRow] ERROR during upload:', err);
      setError('Couldn’t save. Retry.');
    }
  }

  return (
    <section aria-labelledby="photo-title" className="space-y-2">
      <h3 id="photo-title" className="text-sm font-medium text-gray-900">Profile Photo</h3>

      <div className="flex items-center gap-3">
        <img
          src={profilePhotoPreview || stagedPhotoUrl || avatar || "/avatar-placeholder.svg"}
          alt="profile"
          className="h-16 w-16 rounded-full object-cover bg-gray-100"
          onError={e => {
            // fallback to a solid gray background if SVG fails
            e.currentTarget.onerror = null;
            e.currentTarget.src = "data:image/svg+xml,%3Csvg width='56' height='56' viewBox='0 0 56 56' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='28' cy='28' r='28' fill='%23F3F4F6'/%3E%3Cellipse cx='28' cy='23' rx='10' ry='10' fill='%23D1D5DB'/%3E%3Cellipse cx='28' cy='41' rx='16' ry='9' fill='%23E5E7EB'/%3E%3C/svg%3E";
          }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            className="h-10 px-5 rounded-lg bg-[#00FF00] text-white hover:bg-[#00cc00]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
            disabled={uploading}
          >
            {'Take Photo'}
          </button>

          <UploadButton
            onSaved={handlePhoto}
            disabled={uploading}
          />
        </div>
      </div>
      {/* Spinner overlay (no text) while uploading */}
      {uploading && (
        <div className="absolute inset-0 grid place-items-center bg-black/10">
          <span className="sr-only">Saving photo…</span>
          <LoadingSpinner size="md" color="gray" />
        </div>
      )}
      {/* Accessible status, hidden visually */}
      <div aria-live="polite" className="sr-only">
        {uploading ? 'Saving photo…' : error ? 'Photo failed to save.' : ''}
      </div>
      {/* Error chip */}
      {error && (
        <div className="mt-2 inline-flex items-center gap-1 bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs font-medium">
          Couldn’t save. <button className="underline ml-1" onClick={async () => {
            setError(null);
            // Defensive: Try to reconstruct File from storagePath if possible (not always possible client-side)
            if (draft?.image?.storagePath) {
              try {
                const url = `https://firebasestorage.googleapis.com/v0/b/YOUR_BUCKET/o/${encodeURIComponent(draft.image.storagePath)}?alt=media`;
                const res = await fetch(url);
                const blob = await res.blob();
                const file = new File([blob], 'profilePhoto.jpg', { type: blob.type || 'image/jpeg' });
                await handlePhoto(file);
              } catch (e) {
                setError('Couldn’t retry upload. Please re-select your photo.');
              }
            } else {
              setError('No photo available to retry. Please re-select.');
            }
          }}>Retry</button>
        </div>
      )}
      {open && (
        <CameraWithCropModal
          onClose={() => setOpen(false)}
          onSave={handlePhoto}
          roundOutput={true}
        />
      )}
    </section>
  );
}

/* ---------------- Upload button (opens OS picker immediately) ---------------- */
function UploadButton({ onSaved, disabled }: { onSaved: (file: File) => Promise<void>; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="h-10 px-5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          fileRef.current?.click();
        }}
        disabled={disabled}
      >
        {'Upload Photo'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            console.warn('[ProfilePhotoRow/UploadButton] No file selected in input.');
            return;
          }
          // Defensive: log file structure
          console.log('[ProfilePhotoRow/UploadButton] File selected:', file);
          if ('path' in file) {
            console.warn('[ProfilePhotoRow/UploadButton] WARNING: file has a .path property:', (file as any).path);
          }
          await onSaved(file);
        }}
      />
    </>
  );
}



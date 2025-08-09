import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import PhotoModal from "../../../components/PhotoModal";


export default function ProfilePhotoSection() {
  const { update } = useSession();
  const [modal, setModal] = useState<null | "camera" | "upload">(null);
  const [avatar, setAvatar] = useState<string | null>(null); // <- saved dataURL

  return (
    <section className="w-full flex flex-col items-center mb-8">
      <h2 className="text-[15px] font-semibold text-gray-700 mb-4">Profile Photo</h2>
      <div className="flex flex-col items-center mb-4">
        <div className="flex items-center gap-4">
          {/* avatar placeholder / preview */}
          <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 ring-2 ring-orange-500">
            <img
              src={avatar ?? "/avatar-placeholder.svg"}
              alt="profile"
              className="h-full w-full object-cover object-center"
            />
            {avatar && (
              <button
                onClick={() => setAvatar(null)}
                className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full bg-white shadow text-xs text-gray-600 hover:bg-gray-50"
                aria-label="Remove photo"
              >
                ×
              </button>
            )}
          </div>

          {/* action buttons (hide Take/Upload when avatar exists) */}
          {!avatar ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModal("camera")}
                className="h-10 px-5 rounded-lg bg-[#00FF00] text-white hover:bg-[#00cc00]"
              >
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => setModal("upload")}
                className="h-10 px-5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Upload Photo
              </button>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAvatar(URL.createObjectURL(file));
                }}
              />
            </div>
          ) : (
            /* Change button when avatar exists */
            <button
              type="button"
              onClick={() => setModal("camera")}
              className="h-10 px-5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Change Photo
            </button>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500 text-center">
          Upload a clear photo of your face. This helps others recognize you.
        </div>

        {avatar && (
          <div className="mt-2 text-green-600 flex items-center gap-1 text-sm font-medium">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="inline-block">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <PhotoModal
          mode={modal}
          onClose={() => setModal(null)}
           onSave={async (dataUrl: string) => {
            // Defensive logging
            console.log('[ProfilePhotoSection] PhotoModal onSave called with:', dataUrl, typeof dataUrl);
            if (dataUrl === undefined || dataUrl === null) {
              console.error('[ProfilePhotoSection] ERROR: dataUrl is undefined or null!');
              alert('No photo selected or captured.');
              return;
            }
            if (typeof dataUrl !== 'string') {
              console.error('[ProfilePhotoSection] ERROR: dataUrl is not a string:', dataUrl);
              alert('Photo data is invalid.');
              return;
            }
            // Legacy .path warning (should never happen)
            if ((dataUrl as any)?.path) {
              console.warn('[ProfilePhotoSection] WARNING: dataUrl has a .path property:', (dataUrl as any).path);
            }
            setAvatar(dataUrl); // preview immediately
            setModal(null);
            try {
              // Dynamically import upload util to avoid SSR issues
              const { uploadProfilePhotoToFirebase } = await import('../../../lib/uploadProfilePhotoToFirebase');
              const { data: session } = await import('next-auth/react').then(mod => mod.useSession());
              const userId = session?.user?.id;
              if (!userId) throw new Error('No user ID in session');
              // Upload to Firebase and get URL
              const url = await uploadProfilePhotoToFirebase(dataUrl, userId);
              // Save URL to backend
              const res = await fetch('/api/user/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profilePhoto: url }),
              });
              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update profile photo');
              }
              // Force session update so profilePhoto is reflected everywhere
              if (update) await update();
            } catch (err) {
              console.error('[ProfilePhotoSection] ERROR during upload:', err);
              alert('Photo upload failed: ' + (err as Error).message);
            }
          }}
        />
      )}
    </section>
  );
}

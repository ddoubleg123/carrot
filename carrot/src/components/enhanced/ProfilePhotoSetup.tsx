import React, { useRef, useState, useCallback } from 'react';
import PhotoModal from '../PhotoModal';
import styles from './ProfilePhotoSetup.module.css';

interface ProfilePhotoSetupProps {
  initialImage?: string;
  onSave?: (image: string | Blob) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ProfilePhotoSetup: React.FC<ProfilePhotoSetupProps> = ({ initialImage, onSave }) => {
  // --- State ---
  const [modalMode, setModalMode] = useState<"camera" | "upload" | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Modal Handlers ---
  const openCameraModal = useCallback(() => {
    setModalMode("camera");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
  }, []);

  const handleModalSave = useCallback((dataUrl: string) => {
    setCapturedImage(dataUrl);
    setIsCaptured(true);
    setError(null);
    
    // Call the parent's onSave if provided
    if (onSave) {
      onSave(dataUrl);
    }
    
    // Show feedback
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 2000);
  }, [onSave]);

  // --- File Upload ---
  function openPicker(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // block any parent click that opens a modal
    fileInputRef.current?.click(); // open OS file picker only
  }
  async function handleFile(file?: File) {
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    setCapturedImage(dataUrl); // show preview; or open your cropper here
    setIsCaptured(true);
  }
  function fileToDataURL(file: File) {
    return new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // --- Accessibility Feedback ---
  const feedbackMsg = showFeedback ? (
    <div role="status" aria-live="polite" className={styles.feedbackSuccess}>✅ Photo Saved</div>
  ) : null;

  // --- UI States ---
  return (
    <div className={styles.profilePhotoSetup}>
      <div className="flex items-center gap-3">
        {/* avatar placeholder */}
        <img src={capturedImage || '/avatar-placeholder.svg'} alt="" className="h-14 w-14 rounded-full bg-gray-100 object-cover" />
        {/* primary actions (always visible) */}
        <div className="flex gap-2">
          <button
            type="button"
            className="h-10 px-5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={openCameraModal}
          >
            Take Photo
          </button>
          <button
            type="button"
            className="h-10 px-5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={openPicker} // ✅ ONLY this onClick
            data-upload-direct
          >
            Upload Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
      {error && <div className={styles.errorMsg} role="alert">{error}</div>}
      {feedbackMsg}
      
      {/* PhotoModal for camera UI */}
      {modalMode && (
        <PhotoModal
          mode={modalMode}
          onClose={closeModal}
          onSave={handleModalSave}
          initialImage={capturedImage}
        />
      )}
    </div>
  );
};

export default ProfilePhotoSetup;

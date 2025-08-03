"use client";
import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import getCroppedDataURL from "@/utils/getCroppedDataURL";

type Mode = "live" | "crop" | "upload";

interface PhotoModalProps {
  mode: "camera" | "upload";
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  initialImage?: string | null;
}

export default function PhotoModal({ mode, onClose, onSave, initialImage }: PhotoModalProps) {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Mode>(
    initialImage && mode === 'upload' ? 'crop' : (mode === 'upload' ? 'upload' : 'live')
  );
  const [ready, setReady] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage ?? null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ───── helper ───── */
  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) videoRef.current.srcObject = stream;
    streamRef.current = stream;
  }

  /* ───── effect: run camera only in camera mode and live step ───── */
  useEffect(() => {
    if (mode !== 'camera' || step !== 'live') return;
    setReady(false);
    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode, step]);

  /* ───── handlers ───── */
  function capture() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas
      .getContext("2d")!
      .drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setImageSrc(canvas.toDataURL("image/jpeg"));
    setStep("crop");
  }

  function handleRetake() {
    setSaving(false);
    setImageSrc(null);
    setStep(mode === 'upload' ? 'upload' : 'live');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageSrc(ev.target?.result as string);
      setStep('crop');
    };
    reader.readAsDataURL(file);
  }

  // If initialImage changes while modal is open, update imageSrc and step
  useEffect(() => {
    if (initialImage && mode === 'upload') {
      setImageSrc(initialImage);
      setStep('crop');
    }
  }, [initialImage, mode]);

  /* ───── JSX ───── */
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {step === "live" && mode === 'camera' ? "Take Photo" : step === 'upload' && mode === 'upload' ? "Upload Photo" : "Adjust Photo"}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>

          {/* Upload step for upload mode */}
          {step === 'upload' && mode === 'upload' && (
            <>
              <div className="flex flex-col items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-700"
                />
                <button
                  className="h-10 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 px-4"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Camera step for camera mode */}
          {step === "live" && mode === 'camera' && (
            <>
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  onCanPlay={() => setReady(true)}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 h-10 rounded-lg bg-orange-600 text-white font-medium disabled:opacity-50"
                  disabled={!ready}
                  onClick={capture}
                >
                  Capture
                </button>
              </div>
            </>
          )}

          {/* Crop step shared for both modes */}
          {step === "crop" && imageSrc && (
            <>
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(+e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={handleRetake}
                >
                  Retake
                </button>
                <button
                  className={`flex-1 h-10 rounded-lg bg-orange-600 text-white font-medium disabled:opacity-50`}
                  disabled={saving}
                  onClick={async () => {
                    if (!imageSrc || !croppedAreaPixels) return;
                    setSaving(true);
                    console.log("Crop values:", crop, "Zoom:", zoom, "croppedAreaPixels:", croppedAreaPixels, "imageSrc:", imageSrc);
                    const dataUrl = await getCroppedDataURL(imageSrc, croppedAreaPixels);
                    onSave(dataUrl); // Call synchronously to ensure immediate state update
                    setSaving(false);
                    onClose();
                  }}
                >
                  {saving ? 'Saving…' : 'Save Photo'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

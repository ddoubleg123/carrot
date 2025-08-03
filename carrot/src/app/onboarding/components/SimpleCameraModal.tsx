"use client";
import { useEffect, useRef, useState } from "react";

export default function SimpleCameraModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null); // dataURL preview

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        v.onloadedmetadata = () => {
          v.play().catch(() => {});
          setIsReady(true);
        };
      } catch (e) {
        console.error("Camera error:", e);
        onClose();
      }
    }

    start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onClose]);

  function capture() {
    const v = videoRef.current;
    if (!v || !isReady) return;

    // Use an offscreen canvas so we aren't depending on a mounted <canvas/>
    const size = Math.min(v.videoWidth || 720, v.videoHeight || 720);
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;

    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);

    const dataUrl = cv.toDataURL("image/jpeg", 0.92);
    setPhoto(dataUrl);
  }

  function retake() {
    setPhoto(null);
  }

  function save() {
    if (!photo) return;
    onSave(photo);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[min(92vw,420px)] rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-base font-semibold">Take Photo</h4>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="rounded-xl bg-gray-100 overflow-hidden">
          {!photo ? (
            <video ref={videoRef} playsInline muted className="block w-full aspect-square object-cover bg-black" />
          ) : (
            <img src={photo} alt="Preview" className="block w-full aspect-square object-cover" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          {!photo ? (
            <>
              <button type="button" className="text-gray-600" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"                            // ✅ not a submit
                disabled={!isReady}
                onClick={capture}
                className="h-10 px-5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Capture
              </button>
            </>
          ) : (
            <>
              <button type="button" className="text-gray-600" onClick={retake}>
                Retake
              </button>
              <button
                type="button"
                onClick={save}
                className="h-10 px-5 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
              >
                Save Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

export default function CameraWithCropModal({
  onClose,
  onSave,                 // (dataUrl: string) => void
  roundOutput = false,    // set true to bake a circle; otherwise return square
}: {
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  roundOutput?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<"live" | "adjust">("live");
  const [isReady, setIsReady] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // crop state
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);

  useEffect(() => {
    if (stage !== 'live') return;
    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        let retries = 0;

        // Wait for videoRef to be mounted using MutationObserver for robustness
        const ensureVideoMountedAndAttach = () => {
          const v = videoRef.current;
          if (v) {
            v.srcObject = stream;
            v.onloadedmetadata = () => {
              v.play().catch(() => {});
              setIsReady(true);
            };
            if (observer) observer.disconnect();
          } else if (retries < 20) {
            retries++;
            setTimeout(ensureVideoMountedAndAttach, 100);
          } else {
            console.error("Camera error: video element not found after 20 retries");
            if (observer) observer.disconnect();
            onClose();
          }
        };

        // Use MutationObserver to catch video element mount
        if (!videoRef.current && typeof window !== 'undefined') {
          const container = document.querySelector('.relative.rounded-xl.bg-gray-100.overflow-hidden');
          if (container) {
            observer = new MutationObserver(() => {
              if (videoRef.current) {
                ensureVideoMountedAndAttach();
              }
            });
            observer.observe(container, { childList: true, subtree: true });
          }
        }
        ensureVideoMountedAndAttach();
      } catch (e) {
        console.error("Camera error:", e);
        onClose();
      }
    }

    start();
    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onClose, stage]);

  // Capture to dataURL and move to Adjust stage
  function capture() {
    const v = videoRef.current;
    if (!v || !isReady) return;
    const size = Math.min(v.videoWidth || 720, v.videoHeight || 720);
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;

    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);

    const url = cv.toDataURL("image/jpeg", 0.92);
    setImageSrc(url);
    setStage("adjust");
    // stop camera while adjusting
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function save() {
    if (!imageSrc || !croppedPixels) return;
    const out = await getCroppedDataURL(imageSrc, croppedPixels, roundOutput);
    onSave(out);
  }

  function retake() {
    setImageSrc(null);
    setCroppedPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStage("live");
    // restart the camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setTimeout(() => {
      // ensure videoRef is mounted again
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }).then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current!.play().catch(() => {});
            setIsReady(true);
          };
        }
      }).catch((e) => {
        console.error("Camera error:", e);
        onClose();
      });
    }, 100);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[min(92vw,460px)] rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-base font-semibold">
            {stage === "live" ? "Take Photo" : "Adjust Photo"}
          </h4>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>

        <div className="relative rounded-xl overflow-hidden" style={{ height: 360 }}>
          {/* Orange gradient background for crop area */}
          <div
            className="absolute inset-0 z-0"
            style={{
              background: 'linear-gradient(135deg, #F47C23 0%, #FFE0B2 100%)',
              width: '100%',
              height: '100%',
            }}
            aria-hidden="true"
          />
          {stage === "live" ? (
            <video ref={videoRef} playsInline muted className="block w-full h-full object-cover bg-black relative z-10" />
          ) : imageSrc ? (
            <div className="absolute inset-0 z-10">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"                 // circle overlay
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedPixels(pixels)}
                restrictPosition={false}
              />
            </div>
          ) : null}
        </div>

        {stage === "adjust" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-600">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {stage === "live" ? (
            <>
              <button type="button" className="text-gray-600" onClick={onClose}>Cancel</button>
              <button
                type="button"
                disabled={!isReady}
                onClick={capture}
                className="h-10 px-5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Capture
              </button>
            </>
          ) : (
            <>
              <button type="button" className="text-gray-600" onClick={retake}>Retake</button>
              <button type="button" onClick={save} className="h-10 px-5 rounded-lg bg-orange-600 text-white hover:bg-orange-700">
                Save Photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------- crop helper functions -------------------------- */

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Crops to a square using pixel area from react-easy-crop.
 * If roundOutput=true, returns a circular JPEG baked in (with transparent corners filled as white).
 */
async function getCroppedDataURL(src: string, crop: Area, roundOutput = false): Promise<string> {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = crop.width;
  canvas.height = crop.height;

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, crop.width, crop.height
  );

  if (roundOutput) {
    // mask to circle
    const masked = document.createElement("canvas");
    const mctx = masked.getContext("2d")!;
    const size = Math.min(canvas.width, canvas.height);
    masked.width = size;
    masked.height = size;

    // white background so JPEG has no black corners
    mctx.fillStyle = "#fff";
    mctx.fillRect(0, 0, size, size);

    mctx.save();
    mctx.beginPath();
    mctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    mctx.clip();
    mctx.drawImage(canvas, 0, 0, size, size);
    mctx.restore();

    return masked.toDataURL("image/jpeg", 0.92);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

"use client";

import React, { useEffect, useRef, useState } from "react";

export type Aspect = "16:9" | "4:5" | "1:1" | "9:16";

export interface VideoEditResult {
  trimStart: number; // seconds
  trimEnd: number;   // seconds
  aspect: Aspect;
  // Data URL preview thumbnail reflecting aspect (center-crop)
  previewThumb?: string;
}

interface Props {
  src: string; // data URL or blob URL
  isOpen: boolean;
  onApply: (result: VideoEditResult) => void;
  onCancel: () => void;
}

const aspectToRatio = (a: Aspect) => {
  switch (a) {
    case "16:9": return 16 / 9;
    case "4:5": return 4 / 5;
    case "1:1": return 1;
    case "9:16": return 9 / 16;
  }
};

export default function VideoEditorModal({ src, isOpen, onApply, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [aspect, setAspect] = useState<Aspect>("16:9");

  useEffect(() => {
    if (!isOpen) return;
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      setDuration(v.duration || 0);
      setTrimEnd(v.duration || 0);
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [isOpen]);

  const captureThumb = async (): Promise<string | undefined> => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return undefined;

    const targetRatio = aspectToRatio(aspect);
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return undefined;

    // Compute center-crop rect
    let cw = vw;
    let ch = Math.round(vw / targetRatio);
    if (ch > vh) {
      ch = vh;
      cw = Math.round(vh * targetRatio);
    }
    const cx = Math.floor((vw - cw) / 2);
    const cy = Math.floor((vh - ch) / 2);

    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;

    // Seek to mid of trimmed segment for representative frame
    const mid = trimStart + (Math.max(0, trimEnd - trimStart) / 2);
    await new Promise<void>((resolve) => {
      const handler = () => {
        ctx.drawImage(v, cx, cy, cw, ch, 0, 0, cw, ch);
        resolve();
      };
      v.currentTime = Math.min(Math.max(0, mid), duration || mid);
      v.addEventListener("seeked", handler, { once: true });
    });

    return c.toDataURL("image/jpeg", 0.9);
  };

  const apply = async () => {
    const previewThumb = await captureThumb();
    onApply({ trimStart, trimEnd, aspect, previewThumb });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="text-base font-semibold text-gray-900">Edit video</div>
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-full hover:bg-gray-100">Cancel</button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-4">
          <div>
            <div className="rounded-xl overflow-hidden bg-black">
              <video ref={videoRef} src={src} controls className="w-full h-auto" />
            </div>
            <div className="mt-4 text-sm text-gray-600">Duration: {duration.toFixed(2)}s</div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Trim start ({trimStart.toFixed(2)}s)</div>
              <input type="range" min={0} max={duration || 0} step={0.01} value={trimStart} onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd))} className="w-full" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Trim end ({trimEnd.toFixed(2)}s)</div>
              <input type="range" min={0} max={duration || 0} step={0.01} value={trimEnd} onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart))} className="w-full" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Aspect (center-crop)</div>
              <div className="flex gap-2 flex-wrap">
                {["16:9","4:5","1:1","9:16"].map((a) => (
                  <button key={a} onClick={() => setAspect(a as Aspect)} type="button" className={`px-3 py-1.5 rounded-full text-sm border ${aspect===a?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button onClick={apply} className="px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600">Apply</button>
            </div>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

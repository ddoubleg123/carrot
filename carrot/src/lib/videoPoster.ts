// Client-side helper to capture a video frame from a local File
// Returns a JPEG data URL or null on failure
export async function capturePosterFromFile(file: File, atSec = 0.5): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => URL.revokeObjectURL(url);

      video.addEventListener("loadedmetadata", () => {
        const duration = video.duration || 1;
        const t = Math.min(Math.max(atSec, 0), Math.max(0.1, duration * 0.1));
        try { video.currentTime = t; } catch {}
      });
      video.addEventListener("seeked", () => {
        try {
          const w = 640;
          const h = Math.max(1, Math.round(w * (video.videoHeight / (video.videoWidth || 1))));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { cleanup(); return resolve(null); }
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          cleanup();
          resolve(dataUrl);
        } catch {
          cleanup();
          resolve(null);
        }
      });
      video.addEventListener("error", () => { cleanup(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

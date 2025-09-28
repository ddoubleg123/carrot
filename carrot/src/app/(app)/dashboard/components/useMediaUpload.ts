import { useState } from "react";
import { optimizeImage, getOptimalDimensions, isSupportedImageType } from "@/lib/imageOptimization";

export function useMediaUpload() {
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  function removePreview() {
    setPreviewURL(null);
    setUploadProgress(null);
    setUploading(false);
  }

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1️⃣ instant local preview
    setPreviewURL(URL.createObjectURL(file));
    setUploading(true);
    setUploadProgress(0);

    let toUpload = file;
    try {
      // 2️⃣ optimize images using our new system
      if (isSupportedImageType(file)) {
        if (file.size > 10 * 1024 * 1024) {
          alert("Image exceeds 10 MB. Please use a smaller image.");
          setUploading(false);
          setUploadProgress(null);
          return;
        }
        
        // Use our optimized image system
        const dimensions = getOptimalDimensions('post');
        const optimizationResult = await optimizeImage(file, {
          maxSizeMB: dimensions.maxSizeMB,
          maxWidthOrHeight: dimensions.maxWidthOrHeight,
          quality: dimensions.quality,
          useWebWorker: true
        });
        
        toUpload = optimizationResult.optimizedFile;
        console.log(`Image optimized: ${(optimizationResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimizationResult.optimizedSize / 1024 / 1024).toFixed(2)}MB (${optimizationResult.compressionRatio.toFixed(1)}% smaller)`);
      } else if (file.type.startsWith("video/")) {
        if (file.size > 100 * 1024 * 1024) {
          alert("Video exceeds 100 MB. Please trim/compress first.");
          setUploading(false);
          setUploadProgress(null);
          return;
        }
        // Optionally, check duration here with a FileReader/Video element
      }

      // 3️⃣ get presigned URL from our API
      // Requesting presigned URL
      const maxBytes = toUpload.type.startsWith("image/")
        ? 10 * 1024 * 1024 // 10 MB for images
        : 100 * 1024 * 1024; // 100 MB default for videos/others
      const presignedResp = await fetch("/api/getPresignedURL", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: toUpload.type, maxBytes }),
      });
      if (!presignedResp.ok) throw new Error("Failed to get presigned URL");
      const { uploadURL, publicURL } = await presignedResp.json();

      // 4️⃣ upload directly to storage
      // Uploading file
      const uploadResp = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": toUpload.type },
        body: toUpload,
        // Progress tracking is not natively supported by fetch, would need XMLHttpRequest for real progress
      });
      if (!uploadResp.ok) throw new Error("Upload failed");

      setUploading(false);
      setUploadProgress(null);
      // Optionally update previewURL to publicURL if you want to show the uploaded version
      // setPreviewURL(publicURL);
      return publicURL; // caller stores this URL in DB
    } catch (err) {
      setUploading(false);
      setUploadProgress(null);
      alert("Upload failed: " + (err instanceof Error ? err.message : err));
    }
  }

  return { previewURL, handleSelect, removePreview, uploading, uploadProgress };
}

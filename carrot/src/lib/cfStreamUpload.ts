// Client-side helper to upload a File to Cloudflare Stream using a Direct Upload URL (tus)
// Usage:
// 1) const { uploadURL, uid } = await fetch('/api/cf/stream/direct-upload', { method: 'POST' }).then(r => r.json())
// 2) await uploadToCloudflareStream(file, uploadURL, ({ progress }) => setProgress(progress))
// 3) Save post with cfUid=uid and cfStatus='queued'

export type UploadProgress = {
  bytesUploaded: number;
  bytesTotal: number;
  progress: number; // 0..1
};

export async function uploadToCloudflareStream(
  file: File,
  uploadURL: string,
  onProgress?: (p: UploadProgress) => void
): Promise<void> {
  if (typeof window === 'undefined') throw new Error('tus upload must run client-side');

  let Tus: any;
  try {
    // Dynamic import to avoid bundling if unused
    const mod = await import('tus-js-client');
    Tus = mod; // module with { Upload }
  } catch (e) {
    throw new Error('Missing dependency tus-js-client. Please install: npm i tus-js-client');
  }

  return new Promise((resolve, reject) => {
    const upload = new Tus.Upload(file, {
      endpoint: uploadURL,
      uploadUrl: uploadURL, // Cloudflare Stream supports providing the one-time URL directly
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      metadata: {
        filename: file.name,
        filetype: file.type || 'video/mp4',
      },
      onError: (error: Error) => reject(error),
      onProgress: (bytesUploaded: number, bytesTotal: number) => {
        if (onProgress) onProgress({ bytesUploaded, bytesTotal, progress: bytesTotal ? bytesUploaded / bytesTotal : 0 });
      },
      onSuccess: () => resolve(),
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
    });

    upload.start();
  });
}

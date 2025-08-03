// src/utils/crop.ts
// Helper to crop image using react-easy-crop parameters and return a Blob

export default async function getCroppedImg(
  imageSrc: string,
  crop: { x: number; y: number },
  zoom: number,
  aspect = 1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No 2d context'));

      // Calculate cropped area based on react-easy-crop's logic
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      const cropSize = Math.min(naturalWidth, naturalHeight) / zoom;
      const centerX = naturalWidth / 2 - crop.x * cropSize;
      const centerY = naturalHeight / 2 - crop.y * cropSize;

      canvas.width = cropSize;
      canvas.height = cropSize;
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        cropSize / 2,
        cropSize / 2,
        cropSize / 2,
        0,
        2 * Math.PI
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        image,
        centerX - cropSize / 2,
        centerY - cropSize / 2,
        cropSize,
        cropSize,
        0,
        0,
        cropSize,
        cropSize
      );
      ctx.restore();
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas is empty'));
        },
        'image/jpeg',
        0.92
      );
    };
    image.onerror = (err) => reject(err);
  });
}

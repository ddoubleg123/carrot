export default async function getCroppedDataURL(
  src: string,
  croppedAreaPixels: { x: number; y: number; width: number; height: number },
  size = 256 // output square size
): Promise<string> {
  const createImage = (url: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.crossOrigin = "anonymous";
      img.src = url;
    });

  const img = await createImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = canvas.height = size;

  // Use croppedAreaPixels directly
  ctx.drawImage(
    img,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    size,
    size
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

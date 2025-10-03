import * as React from "react";
import { Image as ImageIcon, Film } from "lucide-react";

export type ThumbProps = {
  src?: string;
  type: "IMAGE" | "VIDEO";
  alt?: string;
  className?: string;
  placeholder?: string; // tiny blurred dataURL if available
  loading?: 'eager' | 'lazy';
  decoding?: 'auto' | 'sync' | 'async';
  fetchPriority?: 'high' | 'low' | 'auto';
};

export function Thumb({ src, type, alt = "media", className, placeholder, loading = 'lazy', decoding = 'async', fetchPriority = 'auto' }: ThumbProps) {
  const [failed, setFailed] = React.useState(false);
  
  const handleError = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement, Event>) => {
    console.warn('[Thumb] Media failed to load:', { src, type, alt, error: e });
    setFailed(true);
  };
  
  const isVideoUrl = (url: string) => {
    return /\.(mp4|webm|mov|avi|mkv)$/i.test(url) || url.includes('videodelivery.net') || url.includes('firebasestorage.googleapis.com');
  };
  
  return (
    <div className={`relative ${className ?? ""}`}>
      {!failed && src ? (
        type === "VIDEO" && isVideoUrl(src) ? (
          <video
            src={src}
            className="h-full w-full object-cover"
            preload="metadata"
            muted
            playsInline
            onError={handleError}
            onLoadedData={() => console.log('[Thumb] Video loaded successfully:', src)}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            loading={loading}
            decoding={decoding}
            fetchPriority={fetchPriority as any}
            width={640}
            height={360}
            onError={handleError}
            className="h-full w-full object-cover"
            style={placeholder ? { backgroundImage: `url(${placeholder})`, backgroundSize: "cover" } : undefined}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA] text-[#60646C]">
          {type === "VIDEO" ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-500 text-xs">
              Failed to load
            </div>
          )}
        </div>
      )}
    </div>
  );
}

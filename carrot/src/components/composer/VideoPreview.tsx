import React from 'react';

interface VideoPreviewProps {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  onError: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  onRemove: () => void;
}

export default function VideoPreview({ src, videoRef, onLoadedMetadata, onError, onRemove }: VideoPreviewProps) {
  return (
    <div className="mb-4 relative">
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-96 rounded-xl object-cover"
        controls
        onLoadedMetadata={onLoadedMetadata}
        onError={onError}
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
      >
        ×
      </button>
    </div>
  );
}

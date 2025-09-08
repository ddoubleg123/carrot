import React from 'react';

interface ImagePreviewProps {
  kind: 'image';
  src: string;
  onRemove: () => void;
}

interface ProcessingPreviewProps {
  kind: 'processing';
  status?: string | null;
  progress?: number | null;
}

type MediaPreviewProps = ImagePreviewProps | ProcessingPreviewProps;

export default function MediaPreview(props: MediaPreviewProps) {
  if (props.kind === 'image') {
    return (
      <div className="mb-4 relative">
        <img src={props.src} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
        <button
          type="button"
          onClick={props.onRemove}
          className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
        >
          ×
        </button>
      </div>
    );
  }

  // processing UI (e.g., external ingest in progress)
  const progress = props.progress || 0;
  const status = props.status || 'Preparing Video...';
  return (
    <div className="w-full h-64 rounded-xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 flex flex-col items-center justify-center p-6 mb-4">
      <div className="text-center max-w-sm">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-orange-100"></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-orange-500 transition-all duration-300"
            style={{ clipPath: `conic-gradient(from 0deg, transparent ${360 - (progress || 0) * 3.6}deg, orange ${360 - (progress || 0) * 3.6}deg)` }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
        <div className="font-medium text-gray-900 mb-2">{status}</div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress || 0}%` }}
          />
        </div>
        <div className="text-sm text-gray-600">
          {progress ? `${Math.round(progress)}%` : '0%'} complete
        </div>
      </div>
    </div>
  );
}

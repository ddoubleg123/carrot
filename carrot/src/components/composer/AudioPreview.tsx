import React from 'react';
import AudioPlayer from '../AudioPlayer';

interface AudioPreviewProps {
  audioUrl: string;
  postId: string;
  initialDurationSeconds?: number;
  onRemove: () => void;
}

export default function AudioPreview({ audioUrl, postId, initialDurationSeconds, onRemove }: AudioPreviewProps) {
  return (
    <div className="mb-4">
      <AudioPlayer
        audioUrl={audioUrl}
        postId={postId}
        initialDurationSeconds={initialDurationSeconds}
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-2 text-sm text-red-600 hover:text-red-800"
      >
        Remove audio
      </button>
    </div>
  );
}

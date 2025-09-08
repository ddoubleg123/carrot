import React from 'react';
import AudioRecorder from '../AudioRecorder';
import { useComposer } from './ComposerContext';

interface AudioRecorderModalProps {
  open?: boolean;
  onRecorded: (blob: Blob, url: string, durationSeconds: number) => void;
  onCancel?: () => void;
}

export default function AudioRecorderModal({ open, onRecorded, onCancel }: AudioRecorderModalProps) {
  try {
    const ctx = useComposer();
    if (typeof open === 'undefined') open = ctx.showAudioRecorder;
    if (typeof onCancel === 'undefined') onCancel = () => ctx.setShowAudioRecorder(false);
  } catch {}

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl p-6 max-w-md w-full">
        <AudioRecorder onAudioRecorded={onRecorded} onCancel={onCancel!} />
      </div>
    </div>
  );
}

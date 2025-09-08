import React from 'react';

interface ExternalIngestControlsProps {
  value: string;
  onChange: (v: string) => void;
  tosAccepted: boolean;
  onTosChange: (v: boolean) => void;
  canAttach: boolean;
  isActive: boolean;
  statusLabel?: string;
  progress?: number | null;
  onAttach: () => void;
}

export default function ExternalIngestControls({
  value,
  onChange,
  tosAccepted,
  onTosChange,
  canAttach,
  isActive,
  statusLabel,
  progress,
  onAttach,
}: ExternalIngestControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a video URL (YouTube, X, Reddit, etc.)"
          className="flex-1 border rounded-md px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canAttach) {
              e.preventDefault();
              onAttach();
            }
          }}
        />
        <button
          type="button"
          disabled={!canAttach}
          onClick={onAttach}
          className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
        >
          {isActive ? 'Processing…' : 'Attach'}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={tosAccepted} onChange={(e) => onTosChange(e.target.checked)} />
        I have rights to ingest and repost this content.
      </label>
      {isActive && (
        <div className="text-xs text-gray-600">
          {statusLabel || 'processing'}{typeof progress === 'number' ? ` • ${Math.round(progress)}%` : ''}
        </div>
      )}
    </div>
  );
}

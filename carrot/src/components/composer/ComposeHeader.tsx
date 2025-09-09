import React from 'react';
import { X, Zap, Palette } from 'lucide-react';

interface ComposeHeaderProps {
  onClose: () => void;
  onOpenColorPicker: () => void;
  onRandomizeScheme: () => void;
  currentSchemeName?: string;
}

export default function ComposeHeader({ onClose, onOpenColorPicker, onRandomizeScheme, currentSchemeName }: ComposeHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Create post</h3>
        {currentSchemeName ? (
          <span className="text-xs text-gray-600">Current Color Scheme: {currentSchemeName}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenColorPicker}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Choose color scheme"
          title="Choose color scheme"
        >
          <Palette className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onRandomizeScheme}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Randomize color scheme"
          title="Randomize color scheme"
        >
          <Zap className="w-5 h-5" />
        </button>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close compose">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

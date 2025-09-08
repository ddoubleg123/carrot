import React from 'react';
import { X } from 'lucide-react';

interface ComposeHeaderProps {
  onClose: () => void;
}

export default function ComposeHeader({ onClose }: ComposeHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b">
      <h3 className="text-lg font-semibold">Compose</h3>
      <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close compose">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

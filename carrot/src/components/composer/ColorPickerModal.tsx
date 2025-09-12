"use client";

import React from 'react';
import { X } from 'lucide-react';

export interface ColorScheme {
  name: string;
  gradientFromColor: string;
  gradientToColor: string;
  gradientViaColor?: string;
}

interface ColorPickerModalProps {
  open: boolean;
  schemes: ColorScheme[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export default function ColorPickerModal({ open, schemes, currentIndex, onSelect, onClose }: ColorPickerModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md sm:max-w-lg md:max-w-2xl shadow-xl overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="text-base font-semibold text-gray-900">Choose color scheme</h3>
          <button aria-label="Close" className="p-2 rounded-full hover:bg-gray-100" onClick={onClose}>
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        <div className="p-3 sm:p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 56px)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {schemes.map((s, i) => (
            <button
              key={i}
              className={`relative rounded-xl border overflow-hidden text-left ${i === currentIndex ? 'ring-2 ring-orange-400' : 'hover:shadow'}`}
              onClick={() => onSelect(i)}
              aria-pressed={i === currentIndex}
            >
              <div
                className="h-12 sm:h-14"
                style={{
                  background: `linear-gradient(135deg, ${s.gradientFromColor}, ${s.gradientViaColor || s.gradientFromColor}, ${s.gradientToColor})`,
                }}
              />
              <div className="px-3 py-2 text-sm text-gray-800">{s.name}</div>
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

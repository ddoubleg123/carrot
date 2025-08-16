'use client';

import { useState, useRef } from 'react';
import { Slider } from './ui/slider';

export function MinimalImageUploader() {
  const [imgSrc, setImgSrc] = useState<string>(
    '/placeholder-upload.jpg'
  );
  const [scale, setScale] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  if (!imgSrc) {
    return <div>No image selected</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[300px] mx-auto">
      {/* Image Preview */}
      <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
        <img
          ref={imgRef}
          src={imgSrc}
          alt="Preview"
          className="w-full h-full object-cover rounded-lg"
          style={{ transform: `scale(${scale})` }}
        />
      </div>

      {/* Zoom Slider */}
      <div className="w-full">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Zoom
          </label>
          <div className="flex-1">
            <Slider
              min={1}
              max={2}
              step={0.05}
              value={[scale]}
              onValueChange={(value: number[]) => setScale(value[0])}
              className="w-full"
            />
          </div>
          <span className="text-sm text-gray-500 w-12 text-right">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

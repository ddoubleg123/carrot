import React from 'react';

interface VideoThumbnailsProps {
  thumbnails: string[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export default function VideoThumbnails({ thumbnails, currentIndex, onSelect }: VideoThumbnailsProps) {
  if (!thumbnails?.length) return null;
  return (
    <div className="mt-2">
      <div className="text-sm text-gray-700 mb-2">Choose thumbnail:</div>
      <div className="flex gap-2 overflow-x-auto">
        {thumbnails.map((thumb, index) => (
          <img
            key={index}
            src={thumb}
            alt={`Thumbnail ${index + 1}`}
            className={`w-20 h-12 object-cover rounded cursor-pointer border-2 ${
              currentIndex === index ? 'border-orange-500' : 'border-transparent'
            }`}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}

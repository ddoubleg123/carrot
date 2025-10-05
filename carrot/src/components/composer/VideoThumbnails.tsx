import React, { useState, useEffect } from 'react';

interface ThumbnailData {
  id: string;
  thumbnailUrl: string;
  videoUrl: string;
  content: string;
  createdAt: string;
  userId: string;
}

interface VideoThumbnailsProps {
  thumbnails?: string[]; // For backward compatibility with generated thumbnails
  currentIndex: number;
  onSelect: (index: number) => void;
  onThumbnailSelect?: (thumbnailData: ThumbnailData) => void; // New callback for database thumbnails
  useGallery?: boolean; // Flag to enable gallery mode
}

export default function VideoThumbnails({ 
  thumbnails, 
  currentIndex, 
  onSelect, 
  onThumbnailSelect,
  useGallery = false 
}: VideoThumbnailsProps) {
  const [galleryThumbnails, setGalleryThumbnails] = useState<ThumbnailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch gallery thumbnails when in gallery mode
  useEffect(() => {
    if (useGallery) {
      fetchGalleryThumbnails();
    }
  }, [useGallery]);

  const fetchGalleryThumbnails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/thumbnails/gallery');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setGalleryThumbnails(data.thumbnails || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch thumbnails');
      console.error('Error fetching gallery thumbnails:', err);
    } finally {
      setLoading(false);
    }
  };

  // If using gallery mode, show database thumbnails
  if (useGallery) {
    if (loading) {
      return (
        <div className="mt-2">
          <div className="text-sm text-gray-700 mb-2">Loading thumbnails...</div>
          <div className="flex gap-2 overflow-x-auto">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="w-20 h-12 bg-gray-200 rounded animate-pulse"
              />
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-2">
          <div className="text-sm text-red-600 mb-2">Error loading thumbnails: {error}</div>
          <button
            onClick={fetchGalleryThumbnails}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!galleryThumbnails.length) {
      return (
        <div className="mt-2">
          <div className="text-sm text-gray-500 mb-2">No thumbnails found in gallery</div>
        </div>
      );
    }

    return (
      <div className="mt-2">
        <div className="text-sm text-gray-700 mb-2">Choose from gallery ({galleryThumbnails.length} available):</div>
        <div className="flex gap-2 overflow-x-auto max-h-32">
          {galleryThumbnails.map((thumbData, index) => (
            <div key={thumbData.id} className="flex-shrink-0">
              <img
                src={thumbData.thumbnailUrl}
                alt={`Gallery thumbnail ${index + 1}`}
                className={`w-20 h-12 object-cover rounded cursor-pointer border-2 ${
                  currentIndex === index ? 'border-orange-500' : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => {
                  onSelect(index);
                  onThumbnailSelect?.(thumbData);
                }}
                title={thumbData.content ? thumbData.content.substring(0, 50) + '...' : 'No content'}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Original behavior for generated thumbnails
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

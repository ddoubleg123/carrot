'use client';

import { useRef, useState } from 'react';
import { Upload, Link, X } from 'lucide-react';

interface MediaUploadCardProps {
  onMediaSelect: (media: { url: string; type: 'video' | 'image'; file?: File }) => void;
  selectedMedia: { url: string; type: 'video' | 'image' } | null;
  onClear: () => void;
}

export default function MediaUploadCard({ onMediaSelect, selectedMedia, onClear }: MediaUploadCardProps) {
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // File size validation
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) { // 10 MB limit for images
          alert("Image exceeds 10 MB. Please use a smaller image.");
          event.target.value = "";
          return;
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > 100 * 1024 * 1024) { // 100 MB limit for videos
          alert("Video exceeds 100 MB. Please trim/compress your video first. Current size: " + Math.round(file.size / 1024 / 1024 * 100) / 100 + " MB");
          event.target.value = "";
          return;
        }
      }
      
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      onMediaSelect({ url, type, file });
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      // Basic detection - could be enhanced
      const isVideo = urlInput.includes('.mp4') || urlInput.includes('.mov') || urlInput.includes('youtube') || urlInput.includes('vimeo');
      const type = isVideo ? 'video' : 'image';
      onMediaSelect({ url: urlInput.trim(), type });
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  if (selectedMedia) {
    return (
      <div className="relative">
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
          {selectedMedia.type === 'video' ? (
            <video
              src={selectedMedia.url}
              className="w-full h-full object-cover"
              controls={false}
              muted
            />
          ) : (
            <img
              src={selectedMedia.url}
              alt="Selected media"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <button
          onClick={onClear}
          className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="mt-2 text-sm text-gray-600 capitalize">
          {selectedMedia.type} selected
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* File Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <div className="text-sm font-medium text-gray-900 mb-1">Upload Media</div>
        <div className="text-xs text-gray-500">Video or Image files</div>
      </button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* URL Input */}
      {showUrlInput ? (
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Paste video or image URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex space-x-2">
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add URL
            </button>
            <button
              onClick={() => {
                setShowUrlInput(false);
                setUrlInput('');
              }}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowUrlInput(true)}
          className="w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Link className="w-5 h-5 text-gray-400 mx-auto mb-1" />
          <div className="text-sm text-gray-600">Paste URL</div>
        </button>
      )}
    </div>
  );
}

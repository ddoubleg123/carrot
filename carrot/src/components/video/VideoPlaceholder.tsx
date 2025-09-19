"use client";

import React from 'react';

interface VideoPlaceholderProps {
  className?: string;
  showPlayIcon?: boolean;
  type?: 'video' | 'image' | 'loading';
  aspectRatio?: string;
}

// Professional neutral placeholder - NEVER shows black
export default function VideoPlaceholder({ 
  className = "", 
  showPlayIcon = true,
  type = 'video',
  aspectRatio = '16/9'
}: VideoPlaceholderProps) {
  
  const getIcon = () => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-12 h-12 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        );
      case 'image':
        return (
          <svg className="w-12 h-12 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        );
      case 'loading':
        return (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400"></div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Gradient background - never black */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300">
        {/* Subtle pattern overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
            backgroundSize: '100px 100px'
          }}
        />
      </div>

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Icon */}
        <div className="mb-2 opacity-60">
          {getIcon()}
        </div>
        
        {/* Label */}
        <div className="text-sm font-medium text-gray-500 opacity-75">
          {type === 'loading' ? 'Loading...' : type === 'image' ? 'Image' : 'Video'}
        </div>
      </div>

      {/* Play button overlay for videos */}
      {showPlayIcon && type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white border-opacity-30">
            <svg className="w-8 h-8 text-gray-600 ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      )}

      {/* Subtle border */}
      <div className="absolute inset-0 border border-gray-300 border-opacity-20 rounded-lg"></div>
    </div>
  );
}

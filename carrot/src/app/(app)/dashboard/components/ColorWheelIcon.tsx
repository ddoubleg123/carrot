import React from 'react';

// A vibrant color wheel SVG icon
export default function ColorWheelIcon({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="colorwheel" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rainbow" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5252" />
          <stop offset="0.17" stopColor="#FFEB3B" />
          <stop offset="0.33" stopColor="#4CAF50" />
          <stop offset="0.5" stopColor="#2196F3" />
          <stop offset="0.67" stopColor="#9C27B0" />
          <stop offset="0.83" stopColor="#E040FB" />
          <stop offset="1" stopColor="#FF5252" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#rainbow)" stroke="#fff" strokeWidth="2" />
      <circle cx="16" cy="16" r="10" fill="url(#colorwheel)" />
    </svg>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';

type CarrotLogoProps = {
  size?: number; // pixel size for width/height
  className?: string;
};

export default function CarrotLogo({ size = 32, className }: CarrotLogoProps) {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        fill="currentColor"
      >
        <path d="M12 2L2 7l20 5-10-5zm0 12l9.5-4.5L12 5v9zm0 7l-10-5 10-5 10 5-10 5z" />
      </svg>
    );
  }

  return (
    <Image
      src="/carrot-logo.png"
      alt="Carrot Logo"
      width={size}
      height={size}
      className={className ? `${className} object-contain` : 'object-contain'}
      priority
      onError={() => setUseFallback(true)}
    />
  );
}

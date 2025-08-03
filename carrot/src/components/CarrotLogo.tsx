'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function CarrotLogo() {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24"
        className="h-24 w-24 text-orange-500"
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
      width={96}
      height={96}
      className="h-24 w-24 object-contain"
      priority
    />
  );
}

// This file provides a custom error boundary UI for Next.js App Router
'use client';

import React from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F2] px-4">
      <h1 className="text-3xl font-bold text-[#E03D3D] mb-2">Something went wrong</h1>
      <p className="text-[#8B97A2] mb-6">{error.message || 'An unexpected error occurred. Please try refreshing the page.'}</p>
      <button
        onClick={() => reset()}
        className="rounded-full bg-[#F47C23] hover:bg-[#E03D3D] text-white px-8 py-3 font-semibold transition-colors shadow-lg"
      >
        Refresh
      </button>
    </div>
  );
}

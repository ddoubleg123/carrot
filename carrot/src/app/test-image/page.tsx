'use client';

import Image from 'next/image';

export default function TestImagePage() {
  const publicUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const imagePath = '/carrot-logo.png';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-8">Image Loading Test</h1>
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-semibold mb-2">Debug Info:</h2>
        <p>Public URL: {publicUrl}</p>
        <p>Image Path: {imagePath}</p>
        <p>Full URL: {publicUrl}{imagePath}</p>
      </div>
      
      <div className="space-y-8 w-full max-w-md">
        {/* Test 0: Direct link to image */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">0. Direct Link</h2>
          <a 
            href="/carrot-logo.png" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline block mb-2"
          >
            Open /carrot-logo.png in new tab
          </a>
          <a 
            href="/api/image/carrot-logo.png" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline block"
          >
            Open /api/image/carrot-logo.png in new tab
          </a>
        </div>
        {/* Test 1: Direct img tag */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">1. Direct img tag</h2>
          <img 
            src="/carrot-logo.png" 
            alt="Direct img tag"
            className="h-24 w-auto mx-auto"
            onLoad={() => console.log('Direct img tag loaded')}
            onError={(e) => console.error('Direct img tag failed to load', e)}
          />
        </div>

        {/* Test 2: Next.js Image with unoptimized */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">2. Next.js Image (unoptimized)</h2>
          <div className="h-24 flex items-center justify-center">
            <Image
              src="/carrot-logo.png"
              alt="Next.js Image (unoptimized)"
              width={96}
              height={96}
              unoptimized
              onLoad={() => console.log('Next.js Image (unoptimized) loaded')}
              onError={(e) => console.error('Next.js Image (unoptimized) failed to load', e)}
              className="h-full w-auto"
            />
          </div>
        </div>

        {/* Test 3: Next.js Image with loader */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">3. Next.js Image with custom loader</h2>
          <div className="h-24 flex items-center justify-center">
            <Image
              src="carrot-logo.png"
              alt="Next.js Image (custom loader)"
              width={96}
              height={96}
              loader={({ src }) => `/api/image?src=${encodeURIComponent(src)}`}
              onLoad={() => console.log('Next.js Image (custom loader) loaded')}
              onError={(e) => console.error('Next.js Image (custom loader) failed to load', e)}
              className="h-full w-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

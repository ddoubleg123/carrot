'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report the error client-side for visibility
    console.error('[home/error] Rendering error boundary:', { message: error?.message, digest: error?.digest, stack: error?.stack });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white shadow rounded p-6 space-y-4">
        <h1 className="text-lg font-semibold">Something went wrong loading Home</h1>
        {error?.message && (
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded bg-black text-white"
            onClick={() => reset()}
          >
            Retry
          </button>
          <button
            className="px-4 py-2 rounded border"
            onClick={() => { try { window.location.reload(); } catch {} }}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

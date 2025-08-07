'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

// Simple debug page to display session and cookie information
export default function DebugPage() {
  const [cookies, setCookies] = useState<Record<string, string>>({});
  const [windowUrl, setWindowUrl] = useState('');
  const [isClient, setIsClient] = useState(false);
  // Only call useSession on the client
  const { data: session, status } = isClient ? useSession() : { data: undefined, status: 'loading' } as any;

  useEffect(() => {
    setIsClient(true);
    setWindowUrl(window.location.href);
    // Parse cookies
    const cookieMap: Record<string, string> = {};
    document.cookie.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key) {
        cookieMap[key] = value || '';
      }
    });
    setCookies(cookieMap);
  }, []);

  if (!isClient) {
    return <div>Loading debug information...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Session Status</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify({ status, session }, null, 2)}
          </pre>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Cookies</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(cookies, null, 2)}
          </pre>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Page URL</h2>
          <div className="bg-gray-100 p-4 rounded break-all">
            {windowUrl}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Environment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium">NEXT_PUBLIC_APP_URL</h3>
              <div className="bg-gray-100 p-2 rounded break-all">
                {process.env.NEXT_PUBLIC_APP_URL || 'Not set'}
              </div>
            </div>
            <div>
              <h3 className="font-medium">NODE_ENV</h3>
              <div className="bg-gray-100 p-2 rounded">
                {process.env.NODE_ENV}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                document.cookie.split(';').forEach(c => {
                  const key = c.trim().split('=')[0];
                  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Clear All Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

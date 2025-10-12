"use client";
import React, { useState } from 'react';
import { resolveHero } from '@/lib/media/resolveHero';

export default function TestHeroImages() {
  const [url, setUrl] = useState('https://theathletic.com/');
  const [type, setType] = useState('article');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testHeroResolution = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('[TestHero] Testing hero resolution for:', { url, type });
      const heroResult = await resolveHero({
        url: url,
        type: type as any,
        assetUrl: url
      });

      console.log('[TestHero] Hero resolution result:', heroResult);
      setResult(heroResult);
    } catch (err) {
      console.error('[TestHero] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Hero Image Resolution Test</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL to Test
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/article"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
              </select>
            </div>
            
            <button
              onClick={testHeroResolution}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Hero Resolution'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Hero Resolution Result</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Result Details</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Source:</strong> {result.source || 'N/A'}</div>
                  <div><strong>License:</strong> {result.license || 'N/A'}</div>
                  <div><strong>Dominant Color:</strong> {result.dominant || 'N/A'}</div>
                  <div><strong>Has Hero:</strong> {result.hero ? 'Yes' : 'No'}</div>
                  <div><strong>Has Blur:</strong> {result.blurDataURL ? 'Yes' : 'No'}</div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Hero Image</h3>
                {result.hero ? (
                  <div className="space-y-2">
                    <img
                      src={result.hero}
                      alt="Hero image"
                      className="w-full h-48 object-cover rounded-lg border"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden text-red-600 text-sm">
                      Failed to load image
                    </div>
                    <p className="text-xs text-gray-600 break-all">
                      {result.hero}
                    </p>
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                    No hero image found
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Full Result JSON</h3>
              <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Test URLs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Article URLs</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <button
                    onClick={() => setUrl('https://theathletic.com/')}
                    className="text-blue-600 hover:underline"
                  >
                    The Athletic
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setUrl('https://www.espn.com/nba/story/_/id/123456')}
                    className="text-blue-600 hover:underline"
                  >
                    ESPN NBA Article
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setUrl('https://www.nba.com/bulls/')}
                    className="text-blue-600 hover:underline"
                  >
                    NBA Bulls Official
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Video URLs</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <button
                    onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                    className="text-blue-600 hover:underline"
                  >
                    YouTube Video
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setUrl('https://vimeo.com/123456')}
                    className="text-blue-600 hover:underline"
                  >
                    Vimeo Video
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

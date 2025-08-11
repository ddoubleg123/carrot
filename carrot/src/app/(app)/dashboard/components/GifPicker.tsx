'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

interface GifData {
  id: string;
  title: string;
  source: 'giphy' | 'tenor';
  images: {
    fixed_height?: {
      url: string;
      width: string;
      height: string;
    };
    preview_gif?: {
      url: string;
    };
    // Tenor format
    fixed_height_downsampled?: {
      url: string;
      width: number;
      height: number;
    };
    preview?: {
      url: string;
    };
  };
  // Tenor specific fields
  media_formats?: {
    gif: {
      url: string;
      dims: number[];
    };
    tinygif: {
      url: string;
      dims: number[];
    };
  };
}

export default function GifPicker({ isOpen, onClose, onSelectGif }: GifPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState<GifData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API keys - In production, these should be in environment variables
  const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public demo key
  const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public demo key

  // Fetch trending GIFs on component mount
  useEffect(() => {
    if (isOpen && gifs.length === 0) {
      fetchTrendingGifs();
    }
  }, [isOpen]);

  const fetchTrendingGifs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from both sources in parallel for better variety and quality
      const [giphyResponse, tenorResponse] = await Promise.all([
        // Giphy - Higher quality with better content filtering
        fetch(
          `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12&rating=g&fmt=json`
        ),
        // Tenor - Higher quality trending GIFs
        fetch(
          `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=12&media_filter=gif&contentfilter=high`
        )
      ]);

      const [giphyData, tenorData] = await Promise.all([
        giphyResponse.json(),
        tenorResponse.json()
      ]);

      // Process Giphy GIFs with source tagging
      const giphyGifs = (giphyData.data || []).map((gif: any) => ({
        ...gif,
        source: 'giphy' as const
      }));

      // Process Tenor GIFs with source tagging and format normalization
      const tenorGifs = (tenorData.results || []).map((gif: any) => ({
        id: gif.id,
        title: gif.content_description || gif.h1_title || 'GIF',
        source: 'tenor' as const,
        images: {
          fixed_height_downsampled: {
            url: gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url,
            width: gif.media_formats?.gif?.dims?.[0] || 200,
            height: gif.media_formats?.gif?.dims?.[1] || 200,
          },
          preview: {
            url: gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url,
          }
        },
        media_formats: gif.media_formats
      }));

      // Combine and shuffle for variety
      const combinedGifs = [...giphyGifs, ...tenorGifs];
      const shuffledGifs = combinedGifs.sort(() => Math.random() - 0.5);
      
      setGifs(shuffledGifs);
    } catch (err) {
      setError('Failed to load trending GIFs');
      console.error('Error fetching trending GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Search both sources in parallel for comprehensive results
      const [giphyResponse, tenorResponse] = await Promise.all([
        // Giphy - Higher quality search with better filtering
        fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=g&fmt=json&sort=relevant`
        ),
        // Tenor - Higher quality search results
        fetch(
          `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=12&media_filter=gif&contentfilter=high&sort=relevance`
        )
      ]);

      const [giphyData, tenorData] = await Promise.all([
        giphyResponse.json(),
        tenorResponse.json()
      ]);

      // Process Giphy search results
      const giphyGifs = (giphyData.data || []).map((gif: any) => ({
        ...gif,
        source: 'giphy' as const
      }));

      // Process Tenor search results
      const tenorGifs = (tenorData.results || []).map((gif: any) => ({
        id: gif.id,
        title: gif.content_description || gif.h1_title || query,
        source: 'tenor' as const,
        images: {
          fixed_height_downsampled: {
            url: gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url,
            width: gif.media_formats?.gif?.dims?.[0] || 200,
            height: gif.media_formats?.gif?.dims?.[1] || 200,
          },
          preview: {
            url: gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url,
          }
        },
        media_formats: gif.media_formats
      }));

      // Combine results with relevance-based ordering (Giphy first for search relevance)
      const combinedGifs = [...giphyGifs, ...tenorGifs];
      
      setGifs(combinedGifs);
    } catch (err) {
      setError('Failed to search GIFs');
      console.error('Error searching GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchGifs(searchTerm);
  };

  const handleGifSelect = (gif: GifData) => {
    // Get the highest quality URL based on source
    let gifUrl: string;
    
    if (gif.source === 'giphy') {
      // For Giphy, prefer fixed_height for better quality
      gifUrl = gif.images.fixed_height?.url || gif.images.preview_gif?.url || '';
    } else {
      // For Tenor, prefer the full GIF over tinygif for higher quality
      gifUrl = gif.media_formats?.gif?.url || gif.images.fixed_height_downsampled?.url || '';
    }
    
    onSelectGif(gifUrl);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Choose a GIF</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for GIFs..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Loading GIFs...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchTrendingGifs}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && gifs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No GIFs found. Try a different search term.</p>
            </div>
          )}

          {!loading && !error && gifs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {gifs.map((gif) => {
                // Get preview URL based on source
                const previewUrl = gif.source === 'giphy' 
                  ? gif.images.preview_gif?.url || gif.images.fixed_height?.url
                  : gif.images.preview?.url || gif.images.fixed_height_downsampled?.url;

                return (
                  <button
                    key={`${gif.source}-${gif.id}`}
                    onClick={() => handleGifSelect(gif)}
                    className="relative group rounded-lg overflow-hidden hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <img
                      src={previewUrl}
                      alt={gif.title}
                      className="w-full h-32 object-cover"
                    />
                    {/* Source indicator */}
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {gif.source === 'giphy' ? 'Giphy' : 'Tenor'}
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-200" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <a href="https://giphy.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600">
              GIPHY
            </a>
            {' & '}
            <a href="https://tenor.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600">
              Tenor
            </a>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

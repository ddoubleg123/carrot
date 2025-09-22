'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import CommitmentCard from '../dashboard/components/CommitmentCard';

// Sample groups data that matches CommitmentCard format
const sampleGroups = [
  {
    id: 'clean-energy',
    content: 'Clean Energy Revolution',
    carrotText: 'Renewable Future',
    stickText: 'Fossil Fuel Dependence',
    author: {
      name: '',
      username: 'cleanenergy',
      avatar: '/avatar-placeholder.svg',
      flag: 'US',
      id: 'user-clean'
    },
    homeCountry: 'US',
    location: { zip: '10001', city: 'New York', state: 'NY' },
    stats: {
      likes: 1240,
      comments: 89,
      reposts: 12,
      views: 12400,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: ['https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=400&h=300&format=webp&q=80'],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🌱',
    gradientFromColor: '#10B981',
    gradientToColor: '#059669',
    gradientViaColor: '#34D399',
    gradientDirection: 'to-br'
  },
  {
    id: 'universal-basic-income',
    content: 'Universal Basic Income',
    carrotText: 'Economic Security',
    stickText: 'Poverty & Inequality',
    author: {
      name: '',
      username: 'ubi_advocates',
      avatar: '/avatar-placeholder.svg',
      flag: 'CA',
      id: 'user-ubi'
    },
    homeCountry: 'CA',
    location: { zip: 'M5H 2N2', city: 'Toronto', state: 'ON' },
    stats: {
      likes: 980,
      comments: 67,
      reposts: 8,
      views: 9800,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: ['https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&format=webp&q=80'],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '💰',
    gradientFromColor: '#3B82F6',
    gradientToColor: '#1D4ED8',
    gradientViaColor: '#60A5FA',
    gradientDirection: 'to-br'
  },
  {
    id: 'term-limits',
    content: 'Term Limits for Politicians',
    carrotText: 'Fresh Leadership',
    stickText: 'Career Politicians',
    author: {
      name: '',
      username: 'political_reform',
      avatar: '/avatar-placeholder.svg',
      flag: 'US',
      id: 'user-terms'
    },
    homeCountry: 'US',
    location: { zip: '20001', city: 'Washington', state: 'DC' },
    stats: {
      likes: 2110,
      comments: 145,
      reposts: 23,
      views: 21100,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&format=webp&q=80'],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🗳️',
    gradientFromColor: '#8B5CF6',
    gradientToColor: '#7C3AED',
    gradientViaColor: '#A78BFA',
    gradientDirection: 'to-br'
  },
  {
    id: 'space-exploration',
    content: 'Space Exploration Priority',
    carrotText: 'Cosmic Discovery',
    stickText: 'Earth-Bound Thinking',
    author: {
      name: '',
      username: 'space_advocates',
      avatar: '/avatar-placeholder.svg',
      flag: 'US',
      id: 'user-space'
    },
    homeCountry: 'US',
    location: { zip: '77058', city: 'Houston', state: 'TX' },
    stats: {
      likes: 1560,
      comments: 98,
      reposts: 15,
      views: 15600,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: ['https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=400&h=300&format=webp&q=80'],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🚀',
    gradientFromColor: '#F59E0B',
    gradientToColor: '#D97706',
    gradientViaColor: '#FBBF24',
    gradientDirection: 'to-br'
  },
  {
    id: 'ai-ethics',
    content: 'AI Ethics and Regulation',
    carrotText: 'Responsible AI',
    stickText: 'Unchecked Automation',
    author: {
      name: '',
      username: 'ai_ethics',
      avatar: '/avatar-placeholder.svg',
      flag: 'GB',
      id: 'user-ai'
    },
    homeCountry: 'GB',
    location: { zip: 'SW1A 1AA', city: 'London', state: 'England' },
    stats: {
      likes: 890,
      comments: 56,
      reposts: 7,
      views: 8900,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: ['https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&format=webp&q=80'],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🤖',
    gradientFromColor: '#06B6D4',
    gradientToColor: '#0891B2',
    gradientViaColor: '#22D3EE',
    gradientDirection: 'to-br'
  },
  {
    id: 'climate-action',
    content: 'Climate Action Now',
    carrotText: 'Sustainable Future',
    stickText: 'Environmental Destruction',
    author: {
      name: '',
      username: 'climate_action',
      avatar: '/avatar-placeholder.svg',
      flag: 'DE',
      id: 'user-climate'
    },
    homeCountry: 'DE',
    location: { zip: '10115', city: 'Berlin', state: 'Berlin' },
    stats: {
      likes: 3200,
      comments: 234,
      reposts: 45,
      views: 32000,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: ['https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400&h=300&format=webp&q=80'],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🌍',
    gradientFromColor: '#EF4444',
    gradientToColor: '#DC2626',
    gradientViaColor: '#F87171',
    gradientDirection: 'to-br'
  }
];

export default function PatchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleCreateGroup = () => {
    // TODO: Implement group creation
    console.log('Create group clicked');
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section with Plato */}
      <div 
        className="relative w-full overflow-hidden"
        style={{ height: '50vh' }}
      >
        {/* Background gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #FF6A00 0%, #FF8A00 50%, #FFA500 100%)',
            opacity: 0.9
          }}
        />
        
        {/* Subtle grain texture */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Plato Image - Right side */}
        <div
          className={`absolute right-0 bottom-0 w-[40%] max-w-md h-full flex items-end justify-end pr-4 pb-4 ${
            !isReducedMotion ? 'transform-gpu' : ''
          }`}
          style={{
            transform: !isReducedMotion ? 'translateY(0px)' : 'none',
            willChange: !isReducedMotion ? 'transform' : 'auto'
          }}
        >
          <div className="relative">
            {/* Real Plato image with duotone effect */}
            <div className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 relative">
              <img
                src="/agents/Plato.png"
                alt="Plato"
                className="w-full h-full object-cover rounded-full opacity-20"
                style={{
                  filter: 'grayscale(100%) contrast(1.2) brightness(1.1)',
                  mixBlendMode: 'overlay'
                }}
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400/30 to-orange-600/20 mix-blend-mode-overlay" />
            </div>
          </div>
        </div>

        {/* Quote Overlay - Left/Center */}
        <div
          className={`absolute left-0 top-0 w-full h-full flex items-center justify-center px-8 ${
            !isReducedMotion ? 'transform-gpu' : ''
          }`}
          style={{
            transform: !isReducedMotion ? 'translateY(0px)' : 'none',
            willChange: !isReducedMotion ? 'transform' : 'auto'
          }}
        >
          <div className="max-w-6xl mx-auto text-center lg:text-left">
            {/* Quote in white text */}
            <blockquote className="relative">
              <div className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-wide break-words text-white drop-shadow-lg">
                The more you know, the more you realize you know nothing.
              </div>
            </blockquote>

            {/* Author attribution */}
            <cite className="block mt-4 text-lg md:text-xl text-white font-medium drop-shadow-md">
              — Plato
            </cite>
          </div>
        </div>
      </div>

      {/* Action Row - Overlapping 50/50 on image and white space */}
      <div 
        className="relative z-10 px-4 sm:px-6 lg:px-8"
        style={{ marginTop: '-100px' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Let's go"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-[#E6E8EC] focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent outline-none text-lg placeholder-[#60646C]"
                  aria-label="Search knowledge and groups"
                />
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#60646C]" size={20} />
              </div>

              {/* Create Group Button */}
              <button
                onClick={handleCreateGroup}
                className="h-12 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2 min-w-[140px]"
              >
                <Plus size={20} />
                Create Group
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Grid - Simple tiles */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16 pt-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Explore Groups</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sampleGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
              >
                {/* Header Image */}
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={group.imageUrls[0]}
                    alt={group.content}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                
                {/* Group Info */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                    {group.content}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs">👥</span>
                      </div>
                      <span>{group.stats.likes.toLocaleString()} subscribers</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CommitmentCard, { CommitmentCardProps } from '../dashboard/components/CommitmentCard';
import COLOR_SCHEMES from '../../../config/colorSchemes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CSS Variables for easy tuning
const CSS_VARS = `
  :root {
    --hero-height: 40vh;
    --action-row-offset: calc(60vh - 80px);
  }
  
  @media (max-width: 768px) {
    :root {
      --hero-height: 36vh;
      --action-row-offset: calc(60vh - 70px);
    }
  }
  
  @media (max-width: 480px) {
    :root {
      --hero-height: 34vh;
      --action-row-offset: calc(60vh - 60px);
    }
  }
`;

export default function PatchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(0);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Handle keyboard shortcuts and autofocus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Autofocus on desktop only
    if (window.innerWidth >= 1024) {
      searchInputRef.current?.focus();
    }
    
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement search functionality
      console.log('Searching for:', searchQuery);
    }
  };

  const handleCreateGroup = () => {
    // TODO: Implement create group functionality
    console.log('Creating new group');
  };

  // Sample groups data with CommitmentCard-style formatting
  const groups: CommitmentCardProps[] = [
    {
      id: '1',
      content: 'Clean Energy Revolution',
      carrotText: 'Sustainable future with renewable energy',
      stickText: 'Dependence on fossil fuels',
      author: {
        name: 'Clean Energy Group',
        username: 'cleanenergy',
        avatar: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=400&h=400&format=webp&q=80',
        id: 'cleanenergy'
      },
      location: { zip: '10001', city: 'Global', state: 'Worldwide' },
      stats: {
        likes: 1240,
        comments: 89,
        reposts: 156,
        views: 12400,
        carrots: 890,
        sticks: 350
      },
      timestamp: new Date().toISOString(),
      imageUrls: ['https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=400&h=300&format=webp&q=80'],
      emoji: '🌱',
      gradientFromColor: COLOR_SCHEMES[0].gradientFromColor,
      gradientToColor: COLOR_SCHEMES[0].gradientToColor,
      gradientViaColor: COLOR_SCHEMES[0].gradientViaColor,
      gradientDirection: 'to-r'
    },
    {
      id: '2',
      content: 'Universal Basic Income',
      carrotText: 'Economic security and freedom',
      stickText: 'Dependency and reduced work incentive',
      author: {
        name: 'UBI Advocates',
        username: 'ubi_advocates',
        avatar: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=400&format=webp&q=80',
        id: 'ubi_advocates'
      },
      location: { zip: '10001', city: 'Global', state: 'Worldwide' },
      stats: {
        likes: 980,
        comments: 67,
        reposts: 123,
        views: 9800,
        carrots: 720,
        sticks: 260
      },
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      imageUrls: ['https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&format=webp&q=80'],
      emoji: '💰',
      gradientFromColor: COLOR_SCHEMES[1].gradientFromColor,
      gradientToColor: COLOR_SCHEMES[1].gradientToColor,
      gradientViaColor: COLOR_SCHEMES[1].gradientViaColor,
      gradientDirection: 'to-r'
    },
    {
      id: '3',
      content: 'Term Limits for Politicians',
      carrotText: 'Fresh perspectives and reduced corruption',
      stickText: 'Loss of experienced leadership',
      author: {
        name: 'Political Reform',
        username: 'political_reform',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&format=webp&q=80',
        id: 'political_reform'
      },
      location: { zip: '10001', city: 'Washington', state: 'DC' },
      stats: {
        likes: 2110,
        comments: 145,
        reposts: 234,
        views: 21100,
        carrots: 1650,
        sticks: 460
      },
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      imageUrls: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&format=webp&q=80'],
      emoji: '🏛️',
      gradientFromColor: COLOR_SCHEMES[2].gradientFromColor,
      gradientToColor: COLOR_SCHEMES[2].gradientToColor,
      gradientViaColor: COLOR_SCHEMES[2].gradientViaColor,
      gradientDirection: 'to-r'
    },
    {
      id: '4',
      content: 'Space Exploration Priority',
      carrotText: 'Scientific advancement and human expansion',
      stickText: 'Waste of resources on Earth problems',
      author: {
        name: 'Space Advocates',
        username: 'space_advocates',
        avatar: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=400&h=400&format=webp&q=80',
        id: 'space_advocates'
      },
      location: { zip: '10001', city: 'Global', state: 'Universe' },
      stats: {
        likes: 1560,
        comments: 98,
        reposts: 178,
        views: 15600,
        carrots: 1200,
        sticks: 360
      },
      timestamp: new Date(Date.now() - 259200000).toISOString(),
      imageUrls: ['https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=400&h=300&format=webp&q=80'],
      emoji: '🚀',
      gradientFromColor: COLOR_SCHEMES[3].gradientFromColor,
      gradientToColor: COLOR_SCHEMES[3].gradientToColor,
      gradientViaColor: COLOR_SCHEMES[3].gradientViaColor,
      gradientDirection: 'to-r'
    },
    {
      id: '5',
      content: 'AI Ethics and Regulation',
      carrotText: 'Safe and beneficial AI development',
      stickText: 'Stifling innovation and progress',
      author: {
        name: 'AI Ethics Group',
        username: 'ai_ethics',
        avatar: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&format=webp&q=80',
        id: 'ai_ethics'
      },
      location: { zip: '10001', city: 'Global', state: 'Digital' },
      stats: {
        likes: 890,
        comments: 56,
        reposts: 89,
        views: 8900,
        carrots: 650,
        sticks: 240
      },
      timestamp: new Date(Date.now() - 345600000).toISOString(),
      imageUrls: ['https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&format=webp&q=80'],
      emoji: '🤖',
      gradientFromColor: COLOR_SCHEMES[4].gradientFromColor,
      gradientToColor: COLOR_SCHEMES[4].gradientToColor,
      gradientViaColor: COLOR_SCHEMES[4].gradientViaColor,
      gradientDirection: 'to-r'
    },
    {
      id: '6',
      content: 'Climate Action Now',
      carrotText: 'Preserving planet for future generations',
      stickText: 'Economic disruption and job losses',
      author: {
        name: 'Climate Action',
        username: 'climate_action',
        avatar: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400&h=400&format=webp&q=80',
        id: 'climate_action'
      },
      location: { zip: '10001', city: 'Global', state: 'Earth' },
      stats: {
        likes: 3200,
        comments: 234,
        reposts: 456,
        views: 32000,
        carrots: 2800,
        sticks: 400
      },
      timestamp: new Date(Date.now() - 432000000).toISOString(),
      imageUrls: ['https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400&h=300&format=webp&q=80'],
      emoji: '🌍',
      gradientFromColor: COLOR_SCHEMES[5].gradientFromColor,
      gradientToColor: COLOR_SCHEMES[5].gradientToColor,
      gradientViaColor: COLOR_SCHEMES[5].gradientViaColor,
      gradientDirection: 'to-r'
    }
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_VARS }} />
      
      <div className="bg-gray-50 min-h-screen">
        {/* Hidden heading for accessibility */}
        <h1 className="sr-only">Knowledge - Carrot Patch</h1>
        
        {/* Hero Section - 40% viewport height */}
        <section 
          className="relative w-full overflow-hidden"
          style={{ height: 'var(--hero-height)' }}
        >
          {/* Background gradient with grain */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Plato Portrait - Right side */}
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
            <div className="max-w-4xl mx-auto text-center lg:text-left">
              {/* Quote with duotone gradient effect */}
              <blockquote className="relative">
                <div 
                  className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-wide break-words"
                  style={{
                    background: 'linear-gradient(135deg, #FF6A00 0%, #FF8A00 50%, #FFA500 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                    textShadow: '0 0 20px rgba(255,106,0,0.3)'
                  }}
                >
                  The more you know, the more you realize you know nothing.
                </div>
                
                {/* 45° highlight stroke behind text */}
                <div 
                  className="absolute inset-0 text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-wide opacity-20 break-words"
                  style={{
                    background: 'linear-gradient(45deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.3) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    transform: 'translate(2px, 2px)',
                    zIndex: -1
                  }}
                >
                  The more you know, the more you realize you know nothing.
                </div>
              </blockquote>
              
              {/* Author attribution */}
              <cite className="block mt-4 text-lg md:text-xl text-white/80 font-medium">
                — Plato
              </cite>
            </div>
          </div>
        </section>

        {/* Action Row - Floating at 60% viewport height */}
        <div 
          className="relative z-10 -mt-16"
          style={{ marginTop: 'var(--action-row-offset)' }}
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Let's go"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-lg placeholder-gray-500"
                  aria-label="Search knowledge and groups"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {/* Keyboard shortcut hint */}
                <div className="absolute right-12 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 hidden sm:block">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">/</kbd>
                </div>
              </div>
              
              {/* Create Group Button */}
              <button
                type="button"
                onClick={handleCreateGroup}
                className="h-12 px-8 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-3 whitespace-nowrap relative overflow-hidden group"
              >
                {/* Background pattern */}
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-orange-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Icon with animation */}
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span className="font-bold tracking-wide">Create Group</span>
                </div>
                
                {/* Shine effect */}
                <div className="absolute inset-0 -top-1 -left-1 w-0 h-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 group-hover:w-full group-hover:h-full transition-all duration-500 ease-out" />
              </button>
            </form>
          </div>
        </div>

        {/* Groups Feed - CommitmentCard Style */}
        <section className="py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Explore Groups
          </h2>
          
          <div className="space-y-6">
            {groups.map((group) => (
              <CommitmentCard
                key={group.id}
                {...group}
                onVote={() => {}} // TODO: Implement voting
                onDelete={() => {}} // TODO: Implement deletion
                onBlock={() => {}} // TODO: Implement blocking
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
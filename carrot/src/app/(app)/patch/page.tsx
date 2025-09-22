'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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

  // Sample groups data
  const groups = [
    {
      id: 1,
      title: "Clean Energy",
      subscribers: 1240,
      image: "/api/img?url=https://images.unsplash.com/photo-1466611653911-95081537e5b7&w=400&h=300&format=webp&q=80"
    },
    {
      id: 2,
      title: "Universal Basic Income",
      subscribers: 980,
      image: "/api/img?url=https://images.unsplash.com/photo-1554224155-6726b3ff858f&w=400&h=300&format=webp&q=80"
    },
    {
      id: 3,
      title: "Term Limits",
      subscribers: 2110,
      image: "/api/img?url=https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d&w=400&h=300&format=webp&q=80"
    },
    {
      id: 4,
      title: "Space Exploration",
      subscribers: 1560,
      image: "/api/img?url=https://images.unsplash.com/photo-1446776877081-d282a0f896e2&w=400&h=300&format=webp&q=80"
    },
    {
      id: 5,
      title: "AI Ethics",
      subscribers: 890,
      image: "/api/img?url=https://images.unsplash.com/photo-1677442136019-21780ecad995&w=400&h=300&format=webp&q=80"
    },
    {
      id: 6,
      title: "Climate Action",
      subscribers: 3200,
      image: "/api/img?url=https://images.unsplash.com/photo-1611273426858-450d8e3c9fce&w=400&h=300&format=webp&q=80"
    }
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_VARS }} />
      
      <div className="min-h-screen bg-[#F7F8FA] relative">
        {/* Hidden heading for accessibility */}
        <h1 className="sr-only">Knowledge - Carrot Patch</h1>
        
        {/* Hero Section - 40% viewport height */}
        <section 
          className="relative w-full overflow-hidden"
          style={{ height: 'var(--hero-height)' }}
        >
          {/* Background gradient with grain */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-[#FF6A00] to-[#0A5AFF]"
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
              {/* Fallback SVG Plato silhouette */}
              <div className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80">
                <svg 
                  viewBox="0 0 200 200" 
                  className="w-full h-full text-white/20"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="platoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                      <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                    </linearGradient>
                  </defs>
                  <circle cx="100" cy="100" r="90" fill="url(#platoGradient)" />
                  <circle cx="100" cy="80" r="25" fill="rgba(255,255,255,0.2)" />
                  <path d="M 60 140 Q 100 120 140 140 Q 100 160 60 140" fill="rgba(255,255,255,0.15)" />
                  <text x="100" y="190" textAnchor="middle" className="text-xs fill-white/40 font-serif">
                    Plato
                  </text>
                </svg>
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
                  className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-wide"
                  style={{
                    background: 'linear-gradient(135deg, #FF6A00 0%, #0A5AFF 100%)',
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
                  className="absolute inset-0 text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-wide opacity-20"
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
              <cite className="block mt-4 text-lg md:text-xl text-[#60646C] font-medium">
                — Plato
              </cite>
            </div>
          </div>
        </section>

        {/* Action Row - Floating at 60% viewport height */}
        <div 
          className="relative z-10 px-6 -mt-16"
          style={{ marginTop: 'var(--action-row-offset)' }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Knowledge shared is knowledge squared"
                    className="w-full h-12 px-4 pr-12 rounded-xl border border-[#E6E8EC] focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent outline-none text-lg placeholder-[#60646C]"
                    aria-label="Search knowledge and groups"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#60646C]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {/* Keyboard shortcut hint */}
                  <div className="absolute right-12 top-1/2 transform -translate-y-1/2 text-xs text-[#60646C] hidden sm:block">
                    <kbd className="px-2 py-1 bg-[#F7F8FA] rounded text-xs">/</kbd>
                  </div>
                </div>
                
                {/* Create Group Button */}
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="h-12 px-6 bg-gradient-to-r from-[#FF6A00] to-[#0A5AFF] text-white rounded-xl font-semibold hover:from-[#E55A00] hover:to-[#0947E6] transition-all duration-200 transform hover:scale-105 hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Group
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Groups Grid */}
        <section className="px-6 py-12">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-[#0B0B0F] mb-8 text-center">
              Explore Groups
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <div 
                  key={group.id}
                  className="bg-white rounded-xl border border-[#E6E8EC] overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
                >
                  {/* Group Image */}
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    <img
                      src={group.image}
                      alt={group.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  
                  {/* Group Info */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-[#0B0B0F] mb-2 group-hover:text-[#FF6A00] transition-colors">
                      {group.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[#60646C]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-sm font-medium">
                        {group.subscribers.toLocaleString()} subscribers
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
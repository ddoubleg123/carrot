'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import CreateGroupModal from '@/components/patch/CreateGroupModal';

interface Patch {
  id: string;
  handle: string;
  title: string;
  description: string;
  tags: string[];
  theme: any;
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface PatchPageClientProps {
  patches: Patch[];
}

export default function PatchPageClient({ patches }: PatchPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
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
    setIsCreateGroupModalOpen(true);
  };

  const handleGroupSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/patches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create group');
      }

      const result = await response.json();
      console.log('Group created successfully:', result);
      
      // Update discovered content with real patch ID if we have pending discovery
      const pendingDiscovery = (window as any).pendingDiscovery;
      if (pendingDiscovery && pendingDiscovery.discoveredContent) {
        try {
          await fetch('/api/ai/update-discovery-patch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tempPatchId: pendingDiscovery.patchId,
              realPatchId: result.patch.id
            }),
          });
          console.log('Updated discovered content with real patch ID');
        } catch (error) {
          console.error('Failed to update discovery patch ID:', error);
        }
        // Clean up
        delete (window as any).pendingDiscovery;
      }
      
      // Close the modal
      setIsCreateGroupModalOpen(false);
      
      // Redirect to the new group page
      window.location.href = `/patch/${result.patch.handle}`;
      
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  // Filter patches based on search query
  const filteredPatches = patches.filter(patch =>
    patch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patch.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patch.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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

      {/* Action Row - Centered on orange header border (50/50 overlap) */}
      <div 
        className="relative z-10 px-6"
        style={{ marginTop: '-60px' }}
      >
        <div className="max-w-4xl mx-auto">
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

      {/* Groups Grid - Same size as AI agent tiles */}
      <div className="px-6 pb-16 pt-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Explore Groups</h2>
          
          {filteredPatches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {searchQuery ? 'No groups found matching your search.' : 'No groups available yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPatches.map((patch) => (
                <div
                  key={patch.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group h-[300px] flex flex-col"
                  onClick={() => window.location.href = `/patch/${patch.handle}`}
                >
                  {/* Header Image - Fixed height like AI agent tiles */}
                  <div className="h-[200px] relative overflow-hidden">
                    <div 
                      className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"
                      style={{
                        background: patch.theme?.bg || 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                      }}
                    >
                      <div className="text-6xl opacity-20">
                        {patch.tags[0] === 'clean-energy' ? '🌱' : 
                         patch.tags[0] === 'ubi' ? '💰' :
                         patch.tags[0] === 'term-limits' ? '🗳️' :
                         patch.tags[0] === 'space' ? '🚀' :
                         patch.tags[0] === 'ai' ? '🤖' :
                         patch.tags[0] === 'climate' ? '🌍' : '📚'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Group Info - Fixed height like AI agent tiles */}
                  <div className="h-[100px] p-4 flex flex-col justify-between">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {patch.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-xs">👥</span>
                        </div>
                        <span>{patch._count.members.toLocaleString()} members</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onSubmit={handleGroupSubmit}
      />
    </div>
  );
}

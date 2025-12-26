'use client';

import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import PatchComposer from './PatchComposer';

interface Patch {
  id: string;
  handle: string;
  name: string;
}

interface PatchTabsProps {
  activeTab: string;
  patch: Patch;
  children: React.ReactNode;
}

const tabs = [
  { id: 'chat', label: 'Chat' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'discussions', label: 'Discussions' }
];

export default function PatchTabs({ activeTab, patch, children }: PatchTabsProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleCreatePost = () => {
    setIsComposerOpen(true);
  };

  const handleTabClick = (tabId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tabId === 'chat') {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    // Use current pathname to support both /patch/[handle] and /test-patch
    // Ensure we don't double-encode or add multiple ? characters
    const cleanPathname = pathname.split('?')[0]; // Remove any existing query params from pathname
    router.push(`${cleanPathname}${newUrl}`);
  };

  const handleDiscoveryClick = () => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', 'discovery');
    const cleanPathname = pathname.split('?')[0]; // Remove any existing query params from pathname
    router.push(`${cleanPathname}?${params.toString()}`);
  };

  return (
    <>
      {/* Tabs Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E6E8EC]">
        <div className="px-6 md:px-10">
          <div className="flex items-center justify-between py-4">
            {/* Tabs Container with Horizontal Scroll - aligned with content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-[#FF6A00] text-white'
                        : 'text-[#60646C] hover:text-[#0B0B0F] hover:bg-gray-100'
                    }`}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
                
                {/* Learn Button - styled like Refresh button */}
                <Button
                  onClick={handleDiscoveryClick}
                  variant="outline"
                  size="sm"
                  className={`ml-4 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'discovery'
                      ? 'bg-[#FF6A00] text-white border-[#FF6A00]'
                      : 'text-[#60646C] hover:text-[#0B0B0F] hover:bg-gray-100 border-gray-300'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Learn
                </Button>
                
                {/* Create Post Button - now in the same row as tabs */}
                <Button
                  onClick={handleCreatePost}
                  variant="primary"
                  size="sm"
                  className="ml-4 bg-[#FF6A00] hover:bg-[#E55A00] text-white font-medium px-4 py-2 rounded-lg whitespace-nowrap shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {children}
      </div>

      {/* Composer Modal */}
      <PatchComposer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        patch={patch}
      />
    </>
  );
}
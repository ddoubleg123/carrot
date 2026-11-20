'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
  { id: 'ask', label: 'Ask' },
  { id: 'facts', label: 'Facts' },
  { id: 'discussions', label: 'Discuss' },
  { id: 'chat', label: 'Chat' }
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
    params.delete('learn');
    if (tabId === 'ask') {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    // Use current pathname to support both /patch/[handle] and /test-patch
    // Ensure we don't double-encode or add multiple ? characters
    const cleanPathname = (pathname || '/').split('?')[0]; // Remove any existing query params from pathname
    router.push(`${cleanPathname}${newUrl}`);
  };

  return (
    <>
      {/* Tabs Bar */}
      <div className="border-b border-[#E6E8EC] bg-white">
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
                
                {/* Create Post Button */}
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
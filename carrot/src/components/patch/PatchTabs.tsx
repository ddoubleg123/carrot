'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'sources', label: 'Sources' },
  { id: 'discussions', label: 'Discussions' }
];

export default function PatchTabs({ activeTab, patch, children }: PatchTabsProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleCreatePost = () => {
    setIsComposerOpen(true);
  };

  const handleTabClick = (tabId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tabId === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tabId);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.push(`/patch/${patch.handle}${newUrl}`);
  };

  return (
    <>
      {/* Tabs Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E6E8EC]">
        <div className="max-w-[880px] mx-auto px-6 md:px-10">
          <div className="flex items-center justify-between py-6">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#FF6A00] text-white'
                      : 'text-[#60646C] hover:text-[#0B0B0F] hover:bg-gray-100'
                  }`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Create Post Button */}
            <Button
              onClick={handleCreatePost}
              variant="primary"
              size="sm"
              className="ml-auto bg-[#FF6A00] hover:bg-[#E55A00] text-white font-medium px-4 py-2 rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Post
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 md:px-10">
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
'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
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

  const handleCreatePost = () => {
    setIsComposerOpen(true);
  };

  return (
    <>
      {/* Tabs Bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E6E8EC]">
        <div className="max-w-[880px] mx-auto px-8 md:px-12">
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
                  onClick={() => {
                    // TODO: Navigate to tab
                    console.log('Navigate to tab:', tab.id);
                  }}
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
      <div className="max-w-[880px] mx-auto px-8 md:px-12 py-8 md:py-10">
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
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'resources', label: 'Resources' },
  { id: 'posts', label: 'Posts' },
] as const;

interface PillNavProps {
  activeTab: string;
  patchHandle: string;
}

export default function PillNav({ activeTab, patchHandle }: PillNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', tabId);
    router.push(`/patch/${patchHandle}?${params.toString()}`);
  };

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#E6E8EC]">
      <div className="px-6 py-3">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-180",
                activeTab === tab.id
                  ? "bg-[#0A5AFF] text-white"
                  : "text-[#60646C] hover:bg-gray-100 hover:text-[#0B0B0F]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

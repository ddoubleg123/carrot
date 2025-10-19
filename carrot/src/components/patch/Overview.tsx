'use client';

// Removed custom card styles - using Tailwind directly
import DiscoveryListSingle from '@/app/patch/[handle]/components/DiscoveryListSingle';



interface Patch {
  id: string;
  handle: string;
  name: string;
  description?: string | null;
  tags: string[];
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface OverviewProps {
  patch: Patch;
}

export default function Overview({ patch }: OverviewProps) {
  return (
    <div className="space-y-6 px-6 md:px-10">
      {/* Discovering Content */}
      <div>
        <DiscoveryListSingle patchHandle={patch.handle} />
      </div>


    </div>
  );
}

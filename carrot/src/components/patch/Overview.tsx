'use client';

// Removed custom card styles - using Tailwind directly
import DiscoveryList from '@/app/(app)/patch/[handle]/components/DiscoveryList';



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
        <DiscoveryList patchHandle={patch.handle} />
      </div>


    </div>
  );
}

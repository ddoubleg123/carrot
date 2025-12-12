'use client';

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

interface DiscoveryViewProps {
  patch: Patch;
}

export default function DiscoveryView({ patch }: DiscoveryViewProps) {
  return (
    <div className="space-y-6 px-6 md:px-10">
      {/* Discovery Panel with KPIs */}
      <div>
        <DiscoveryList patchHandle={patch.handle} />
      </div>
    </div>
  );
}


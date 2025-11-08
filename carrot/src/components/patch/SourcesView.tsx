'use client';

import DiscoveringContent from './DiscoveringContent';

interface Patch {
  id: string;
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

interface SourcesViewProps {
  patch: Patch;
  patchHandle: string;
}

export default function SourcesView({ patch: _patch, patchHandle }: SourcesViewProps) {
  return (
    <div className="px-6 md:px-10">
      <DiscoveringContent patchHandle={patchHandle} />
    </div>
  );
}

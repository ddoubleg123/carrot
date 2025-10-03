'use client';

import ResourcesList from './ResourcesList';

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

export default function SourcesView({ patch, patchHandle }: SourcesViewProps) {
  return (
    <div className="px-6 md:px-10">
      <ResourcesList patch={patch} patchHandle={patchHandle} />
    </div>
  );
}

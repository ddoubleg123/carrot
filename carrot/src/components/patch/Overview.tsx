'use client';

// Removed custom card styles - using Tailwind directly
import { Badge } from '@/components/ui/badge';
import DiscoveryListSingle from '@/app/patch/[handle]/components/DiscoveryListSingle';

interface Fact {
  id: string;
  label: string;
  value: string;
  source?: {
    id: string;
    title: string;
    url: string;
  } | null;
}


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
  // Mock data for now - in real implementation, this would come from props or API
  const facts: Fact[] = [
    { id: '1', label: 'Current Status', value: 'Active Movement' },
    { id: '2', label: 'Primary Goal', value: 'Congressional Term Limits' },
    { id: '3', label: 'Proposed Limit', value: '12 Years Maximum' },
    { id: '4', label: 'Support Level', value: '78% Public Support' },
  ];
  return (
    <div className="space-y-6 px-6 md:px-10">
      {/* Discovering Content */}
      <div>
        <DiscoveryListSingle patchHandle={patch.handle} />
      </div>

      {/* Key Facts Grid */}
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-[#0B0B0F] mb-6">Key Facts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {facts.slice(0, 8).map((fact) => (
            <div key={fact.id} className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-medium text-[#0B0B0F]">
                  {fact.label}
                </h3>
                {fact.source && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200"
                    title={`Source: ${fact.source.title}`}
                  >
                    📄
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[#60646C] leading-relaxed">
                {fact.value}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

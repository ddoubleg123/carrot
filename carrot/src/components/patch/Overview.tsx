'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { DiscoveryCard } from '@/app/(app)/patch/[handle]/components/DiscoveryCard';
import { DiscoveryCardPayload } from '@/types/discovery-card';
import ContentModal from '@/app/(app)/patch/[handle]/components/ContentModal';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

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

const INITIAL_BATCH = 6;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function Overview({ patch }: OverviewProps) {
  const router = useRouter();
  const [visibleItemsCount, setVisibleItemsCount] = useState(INITIAL_BATCH);
  const [selectedItem, setSelectedItem] = useState<DiscoveryCardPayload | null>(null);

  // Fetch discovered content
  const { data, error, isLoading } = useSWR(
    `/api/patches/${patch.handle}/discovered-content?limit=100`,
    fetcher
  );

  const items: DiscoveryCardPayload[] = useMemo(() => {
    if (!data?.items) return [];
    const seen = new Set<string>();
    return data.items.filter((item: DiscoveryCardPayload) => {
      if (seen.has(item.canonicalUrl || item.url)) {
        return false;
      }
      seen.add(item.canonicalUrl || item.url);
      return true;
    });
  }, [data]);

  const visibleItems = items.slice(0, visibleItemsCount);
  const hasMoreItems = items.length > visibleItemsCount;

  const handleLoadMore = () => {
    setVisibleItemsCount((prev) => Math.min(prev + INITIAL_BATCH, items.length));
  };

  const handleSelect = (item: DiscoveryCardPayload) => {
    const itemAny = item as any;
    const urlSlug = itemAny.metadata?.urlSlug || 
                    itemAny.urlSlug || 
                    (itemAny.metadata?.contentUrl?.split('/').pop());
    
    if (urlSlug) {
      router.push(`/patch/${patch.handle}/content/${urlSlug}`);
    } else {
      setSelectedItem(item);
    }
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  return (
    <div className="space-y-6 px-6 md:px-10">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load content. Please try refreshing.
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
          <Search className="h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No content yet</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Use the Discovery tab to start finding content for this patch.
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {visibleItems.map((item) => (
              <DiscoveryCard
                key={item.canonicalUrl || item.id}
                item={item}
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>

          {hasMoreItems && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Load more ({items.length - visibleItemsCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      <ContentModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={handleCloseModal}
      />
    </div>
  );
}

'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import CreateGroupModal from '@/components/patch/CreateGroupModal';
import { PortraitCard, PortraitGrid } from '@/components/search/PortraitCard';
import { HalfPageAd, useBoardAdSlot } from '@/components/search/HalfPageAd';

interface Patch {
  id: string;
  handle: string;
  title: string;
  description: string;
  tags: string[];
  theme: any;
  cover?: string;
  _count: {
    members: number;
    posts: number;
    events: number;
    sources: number;
  };
}

interface PatchPageClientProps {
  patches: Patch[];
}

type GroupPost = {
  id: string;
  href: string;
  group: string;
  text: string;
  image?: string;
  createdAt: string;
};

function GroupPosts({ posts, searching, error }: { posts: GroupPost[]; searching: boolean; error: string }) {
  const slot = useBoardAdSlot(posts.map((post) => post.id).join('|'), posts.length);
  if (error) return <p className="mt-8 px-1 text-sm leading-6 text-[#B91C1C]">{error}</p>;
  if (searching && posts.length === 0) return <p className="mt-8 px-1 text-sm leading-6 text-[#60646C]">Searching…</p>;
  if (posts.length === 0) return <p className="mt-8 px-1 text-sm leading-6 text-[#60646C]">No posts match that search.</p>;
  return (
    <PortraitGrid className="mt-6">
      {posts.map((post, index) => (
        <Fragment key={post.id}>
          {index === slot && <HalfPageAd />}
          <PortraitCard
            href={post.href}
            image={post.image}
            title={post.text}
            byline={post.group}
            meta={new Date(post.createdAt).toLocaleDateString()}
          />
        </Fragment>
      ))}
      {slot === posts.length && <HalfPageAd />}
    </PortraitGrid>
  );
}

export default function PatchPageClient({ patches }: PatchPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [postsKey, setPostsKey] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const requestId = useRef(0);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);

  const handleCreateGroup = () => {
    setIsCreateGroupModalOpen(true);
  };

  const handleGroupSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/patches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create group');
      }

      const result = await response.json();
      console.log('Group created successfully:', result);
      
      // Update discovered content with real patch ID if we have pending discovery
      const pendingDiscovery = (window as any).pendingDiscovery;
      if (pendingDiscovery && pendingDiscovery.discoveredContent) {
        try {
          await fetch('/api/ai/update-discovery-patch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tempPatchId: pendingDiscovery.patchId,
              realPatchId: result.patch.id
            }),
          });
          console.log('Updated discovered content with real patch ID');
        } catch (error) {
          console.error('Failed to update discovery patch ID:', error);
        }
        // Clean up
        delete (window as any).pendingDiscovery;
      }
      
      // Close the modal
      setIsCreateGroupModalOpen(false);
      
      // Redirect to the new group page
      window.location.href = `/patch/${result.patch.handle}`;
      
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const res = await fetch(`/api/groups/search?q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (id !== requestId.current) return;
        if (!res.ok) setSearchError(json?.error || 'Search failed');
        setPosts(Array.isArray(json?.posts) ? json.posts : []);
        setPostsKey(query);
      } catch {
        if (controller.signal.aborted || id !== requestId.current) return;
        setSearchError('Search failed. Try again.');
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [searchQuery]);

  const query = searchQuery.trim();
  const postsReady = query.length >= 2 && postsKey === query;
  const filteredPatches = patches;

  return (
    <div className="min-h-screen bg-white text-[#0B0B0F]">
      <div className="mx-auto max-w-[1120px] px-5 pb-16 pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Carrot Patch</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-[2.5rem] font-semibold leading-none tracking-[-0.035em]">Groups</h1>
          <button
            type="button"
            onClick={handleCreateGroup}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#FF6A00] px-4 text-sm font-semibold text-white hover:bg-[#E55A00]"
          >
            <Plus size={16} />
            Create group
          </button>
        </div>

        <div className="mt-6 flex items-center rounded-full border border-[#E6E8EC] px-4 focus-within:border-[#FF6A00]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts in groups"
            className="h-12 w-full bg-transparent px-1 text-base outline-none placeholder:text-[#8A8F98]"
            aria-label="Search posts in groups"
          />
        </div>

        {query.length >= 2 ? (
          <GroupPosts posts={postsReady ? posts : []} searching={!postsReady || searching} error={searchError} />
        ) : filteredPatches.length === 0 ? (
          <p className="mt-8 text-sm leading-6 text-[#60646C]">No groups yet.</p>
        ) : (
          <div className="mt-2 border-t border-[#E6E8EC]">
            {filteredPatches.map((patch) => (
              <Link
                key={patch.id}
                href={`/patch/${patch.handle}`}
                className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 border-b border-[#E6E8EC] py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
              >
                <div className="h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg bg-[#E7E5E4]">
                  {patch.cover ? (
                    <img src={patch.cover} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] group-hover:text-[#E55A00]">{patch.title}</h2>
                  {patch.description ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-[#60646C]">{patch.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-[13px] text-[#8A8F98] sm:hidden">
                    {patch._count.members.toLocaleString()} {patch._count.members === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <span className="hidden text-[13px] text-[#8A8F98] sm:block">
                  {patch._count.members.toLocaleString()} {patch._count.members === 1 ? 'member' : 'members'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onSubmit={handleGroupSubmit}
      />
    </div>
  );
}

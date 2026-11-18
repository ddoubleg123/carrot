import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { Plus, Search } from 'lucide-react';
import PatchPageClient from './PatchPageClient';
import { ensureGroupCover } from '@/lib/groups/cover';

const loadPatches = unstable_cache(async () => {
  const patches = await prisma.patch.findMany({
    include: {
      _count: {
        select: {
          members: true,
          posts: true,
          events: true,
          sources: true,
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 60
  });
  return patches.map((patch) => ({ ...patch, name: patch.title }));
}, ['explore-patches-photos-2'], { revalidate: 60 });

export default async function PatchPage() {
  const patchesWithName = await loadPatches();
  const patches = await Promise.all(patchesWithName.map(async (patch) => ({
    ...patch,
    cover: await ensureGroupCover(patch, { remote: false }).catch(() => '')
  })));

  return <PatchPageClient patches={patches} />;
}
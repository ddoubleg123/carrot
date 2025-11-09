import { prisma } from '@/lib/prisma';
import { Plus, Search } from 'lucide-react';
import PatchPageClient from './PatchPageClient';

export default async function PatchPage() {
  // Fetch recent patches for Explore Groups
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

  const patchesWithName = patches.map((patch) => ({ ...patch, name: patch.title }))

  return <PatchPageClient patches={ patchesWithName } />;
}
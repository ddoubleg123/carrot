import { prisma } from '@/lib/prisma';
import { Plus, Search } from 'lucide-react';
import PatchPageClient from './PatchPageClient';

export default async function PatchPage() {
  // Fetch patches from database
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
    take: 12
  });

  return <PatchPageClient patches={patches} />;
}
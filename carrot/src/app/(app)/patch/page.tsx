import { prisma } from '@/lib/prisma';
import { Plus, Search } from 'lucide-react';
import PatchPageClient from './PatchPageClient';

export default async function PatchPage() {
  // Only fetch the two allowed patches: history and term-limits-politicians
  const patches = await prisma.patch.findMany({
    where: {
      handle: {
        in: ['history', 'term-limits-politicians']
      }
    },
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
    }
  });

  return <PatchPageClient patches={patches} />;
}
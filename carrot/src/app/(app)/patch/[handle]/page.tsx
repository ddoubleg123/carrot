import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getPatchThemeClass } from '@/lib/patch-theme'
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  FileText, 
  Link, 
  Image, 
  Video, 
  Upload,
  Clock,
  BookOpen,
  Share2,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Grid
} from 'lucide-react'

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'

    console.log('[PatchPage] Loading patch with handle:', handle)

    // Simple patch query without complex includes
    let patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        description: true,
        theme: true,
        tags: true,
        createdBy: true,
        createdAt: true,
      }
    });

    if (!patch) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Patch Not Found</h1>
            <p className="text-gray-600">The patch "{handle}" does not exist.</p>
          </div>
        </div>
      );
    }

    // Get theme class
    const themeClass = getPatchThemeClass(patch.theme as string | null);

    return (
      <div className={`min-h-screen ${themeClass}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{patch.name}</h1>
            <p className="text-lg text-gray-600 mb-4">Community discussion space</p>
            <p className="text-gray-700 mb-4">{patch.description}</p>
            <div className="flex gap-2 mb-4">
              {patch.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-500">
              <p>Handle: {patch.handle}</p>
              <p>Theme: {patch.theme as string || 'light'}</p>
              <p>Created: {patch.createdAt.toLocaleDateString()}</p>
              <p>Active Tab: {activeTab}</p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Patch page error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Patch</h1>
          <p className="text-gray-600 mb-4">There was an error loading this patch page.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-sm text-gray-500">Please try refreshing the page or contact support if the issue persists.</p>
        </div>
      </div>
    );
  }
}

export async function generateMetadata({ params }: PatchPageProps): Promise<Metadata> {
  const { handle } = await params;

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      name: true,
      description: true,
      tags: true,
    }
  });

  if (!patch) {
    return {
      title: 'Patch Not Found',
    };
  }

  return {
    title: `${patch.name} - Carrot Patch`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}
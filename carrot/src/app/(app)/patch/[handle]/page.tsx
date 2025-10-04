import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import RightRail from '@/components/patch/RightRail'
import TimelineView from '@/components/patch/TimelineView'
import Overview from '@/components/patch/Overview'
import DocumentsView from '@/components/patch/DocumentsView'
import SourcesView from '@/components/patch/SourcesView'
import DiscussionsView from '@/components/patch/DiscussionsView'
import COLOR_SCHEMES from '@/config/colorSchemes'
import PerfTracker from '@/components/PerfTracker'

// Helper function to convert preset string to index
function getPresetIndex(preset: string | null | undefined): number | undefined {
  if (!preset) return undefined;
  
  // Map preset strings to indices
  const presetMap: { [key: string]: number } = {
    'following': 0,
    'for-you': 1,
    'subjects': 2
  };
  
  return presetMap[preset] ?? undefined;
}

      <Suspense fallback={<PatchPageSkeleton />}>
        <div className="min-h-screen bg-white">
          {/* Web Vitals telemetry */}
          <PerfTracker />
          {/* Header */}
          <PatchHeader
            patch={{
              ...patch,
              updatedAt: patch.updatedAt.toISOString()
            }}
            userTheme={actualUserTheme ? {
              mode: actualUserTheme.mode as 'preset' | 'image',
              preset: getPresetIndex(actualUserTheme.preset),
              image: actualUserTheme.image || undefined
            } : null}
          />

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-8">
              {/* Main Content Area */}
              <div className="max-w-[880px]">
                <PatchTabs activeTab={activeTab} patch={patch}>
                  {activeTab === 'overview' && <Overview patch={patch} />}
                  {activeTab === 'documents' && <DocumentsView patch={patch} />}
                  {activeTab === 'timeline' && <TimelineView events={formattedEvents as any} patchId={patch.id} />}
                  {activeTab === 'sources' && <SourcesView patch={patch} patchHandle={handle} />}
                  {activeTab === 'discussions' && <DiscussionsView patch={patch} />}
                </PatchTabs>
              </div>

              {/* Right Rail */}
              <div className="w-[320px]">
                <RightRail
                  patch={patch}
                  followers={actualFollowers}
                  botSubscriptions={botSubscriptionsWithBotData as any}
                  followerCount={actualFollowerCount}
                />
              </div>
            </div>
          </div>
        </div>
      </Suspense>
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
import React from 'react';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function HistoryPatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'

    console.log('[HistoryPatchPage] Loading History patch with handle:', handle)

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
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">History Not Found</h1>
            <p className="text-gray-400">The historical repository "{handle}" does not exist.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Dark Academic Header */}
        <div className="bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16">
            <div className="py-16">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl">
                      <span className="text-white text-2xl font-bold">📚</span>
                    </div>
                    <div>
                      <h1 className="text-5xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        {patch.name}
                      </h1>
                      <p className="text-gray-300 text-xl leading-relaxed max-w-4xl">
                        {patch.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Academic Tags */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex gap-3">
                      {patch.tags.map((tag) => (
                        <span key={tag} className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-full text-sm font-medium border border-amber-500/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Academic Stats */}
                  <div className="flex items-center gap-8 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>🎓</span>
                      <span>2,847 Scholars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📜</span>
                      <span>15,623 Documents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🏛️</span>
                      <span>8,941 Sources</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🕒</span>
                      <span>Updated {patch.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <span>📤</span>
                    Share Repository
                  </button>
                  <button className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 font-semibold">
                    <span>➕</span>
                    Join Scholars
                  </button>
                  <button className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <span>⚙️</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {/* Academic Navigation */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 overflow-hidden mb-8">
                <div className="bg-slate-900 border-b border-gray-700 px-8 py-6">
                  <div className="flex space-x-8">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'documents', label: 'Documents' },
                      { id: 'timeline', label: 'Timeline' },
                      { id: 'sources', label: 'Sources' },
                      { id: 'discussions', label: 'Discussions' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === tab.id
                            ? 'border-amber-500 text-amber-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-8">
                  <div className="space-y-8">
                    <h2 className="text-2xl font-bold text-white mb-6">🎓 Academic Repository</h2>
                    <p className="text-gray-300 text-lg leading-relaxed">
                      This is the NEW History template with a completely different dark academic theme. 
                      It should look nothing like the Term Limits page.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-800 rounded-xl border border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">📚 Documents</h3>
                        <p className="text-gray-400">15,623 historical documents</p>
                      </div>
                      <div className="bg-slate-800 rounded-xl border border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">🏛️ Sources</h3>
                        <p className="text-gray-400">8,941 primary sources</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-bold text-white mb-6">Scholar Actions</h3>
                <div className="space-y-4">
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-700 rounded-xl transition-colors">
                    <span className="text-2xl">📄</span>
                    <span className="text-lg font-medium text-white">Add Document</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-700 rounded-xl transition-colors">
                    <span className="text-2xl">📤</span>
                    <span className="text-lg font-medium text-white">Upload Source</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-700 rounded-xl transition-colors">
                    <span className="text-2xl">💬</span>
                    <span className="text-lg font-medium text-white">Start Discussion</span>
                  </button>
                </div>
              </div>

              {/* Repository Statistics */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-bold text-white mb-6">Repository Statistics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total Documents</span>
                    <span className="font-bold text-xl text-amber-400">15,623</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Primary Sources</span>
                    <span className="font-bold text-xl text-amber-400">8,941</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Active Scholars</span>
                    <span className="font-bold text-xl text-amber-400">2,847</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Discussions</span>
                    <span className="font-bold text-xl text-amber-400">1,234</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('History patch page error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading History</h1>
          <p className="text-gray-400 mb-4">There was an error loading the History repository.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
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
      title: 'History Not Found',
    };
  }

  return {
    title: `${patch.name} - Carrot History`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}

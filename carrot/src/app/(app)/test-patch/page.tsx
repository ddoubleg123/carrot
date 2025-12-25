'use client'

import { useSearchParams } from 'next/navigation'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import RightRail from '@/components/patch/RightRail'
import TimelineView from '@/components/patch/TimelineView'
import Overview from '@/components/patch/Overview'
import DocumentsView from '@/components/patch/DocumentsView'
import DiscoveryView from '@/components/patch/DiscoveryView'
import DiscussionsView from '@/components/patch/DiscussionsView'

// Mock patch data matching the Israel patch structure
const mockPatch = {
  id: 'test-patch-israel',
  handle: 'israel',
  title: 'Israel',
  description: 'A comprehensive collection of information about Israel, its history, culture, politics, and current events.',
  tagline: 'Understanding Israel through comprehensive research',
  tags: ['israel', 'middle-east', 'politics', 'history', 'culture'],
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date().toISOString(),
  name: 'Israel',
  _count: {
    members: 127,
    posts: 45,
    events: 23,
    sources: 156
  },
  members: [],
  botSubscriptions: []
}

// Mock followers data
const mockFollowers = [
  {
    id: 'follower-1',
    user: {
      id: 'user-1',
      name: 'John Doe',
      image: null,
      profilePhoto: null,
      username: 'johndoe'
    }
  },
  {
    id: 'follower-2',
    user: {
      id: 'user-2',
      name: 'Jane Smith',
      image: null,
      profilePhoto: null,
      username: 'janesmith'
    }
  }
]

// Mock bot subscriptions
const mockBotSubscriptions: any[] = []

// Mock timeline events
const mockEvents = [
  {
    id: 'event-1',
    title: 'Patch created',
    dateStart: new Date('2024-01-01').toISOString(),
    dateEnd: undefined,
    summary: 'The Israel patch was created',
    tags: ['created'],
    sources: []
  }
]

export default function TestPatchPage() {
  const searchParams = useSearchParams()
  const activeTab = (searchParams?.get('tab') as string) || 'overview'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <PatchHeader
        patch={mockPatch as any}
        userTheme={null}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-8">
          {/* Main Content Area */}
          <div className="max-w-[880px] min-w-0">
            <PatchTabs 
              activeTab={activeTab} 
              patch={mockPatch as any}
            >
              {activeTab === 'overview' && <Overview patch={mockPatch as any} />}
              {activeTab === 'documents' && <DocumentsView patch={mockPatch as any} />}
              {activeTab === 'timeline' && <TimelineView events={mockEvents as any} patchId={mockPatch.id} />}
              {activeTab === 'discovery' && <DiscoveryView patch={mockPatch as any} />}
              {activeTab === 'discussions' && <DiscussionsView patch={mockPatch as any} />}
            </PatchTabs>
          </div>

          {/* Right Rail */}
          <div className="w-[320px] shrink-0 min-w-0">
            <RightRail
              patch={mockPatch as any}
              followers={mockFollowers}
              botSubscriptions={mockBotSubscriptions}
              followerCount={mockFollowers.length}
            />
          </div>
        </div>
      </div>
    </div>
  )
}


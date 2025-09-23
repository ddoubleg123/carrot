'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Users, MessageSquare, Calendar, BookOpen } from 'lucide-react'

interface Fact {
  id: string
  label: string
  value: string
  source?: {
    id: string
    title: string
    url: string
  } | null
}

interface Patch {
  id: string
  name: string
  handle: string
}

interface FactSheetProps {
  patch: Patch
  facts: Fact[]
  stats: {
    members: number
    posts: number
    events: number
    sources: number
  }
}

export default function FactSheet({ patch, facts, stats }: FactSheetProps) {
  return (
    <div className="space-y-6">
      {/* Patch Info Card */}
      <Card className="rounded-2xl border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">
            {patch.name}
          </CardTitle>
          <p className="text-sm text-gray-600">r/{patch.handle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{stats.members.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{stats.posts.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{stats.events.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{stats.sources.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facts Card */}
      {facts.length > 0 && (
        <Card className="rounded-2xl border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Fact Sheet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {facts.map((fact) => (
              <div key={fact.id} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <dt className="text-sm font-medium text-gray-900 mb-1">
                      {fact.label}
                    </dt>
                    <dd className="text-sm text-gray-700">
                      {fact.value}
                    </dd>
                  </div>
                  {fact.source && (
                    <a
                      href={fact.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                      title={`Source: ${fact.source.title}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="rounded-2xl border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <button className="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">Share this patch</div>
            <div className="text-sm text-gray-600">Invite others to join</div>
          </button>
          <button className="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">Report content</div>
            <div className="text-sm text-gray-600">Help keep the community safe</div>
          </button>
          <button className="w-full text-left p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="font-medium text-gray-900">View rules</div>
            <div className="text-sm text-gray-600">Community guidelines</div>
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

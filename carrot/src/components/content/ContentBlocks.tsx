'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, User, Users, Building2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ContentBlocksProps {
  summary: string
  keyPoints: string[]
  excerptHtml?: string
  entities?: string[]
  timeline?: Array<{date: string, fact: string}>
}

const ENTITY_ICONS = {
  person: User,
  team: Users,
  organization: Building2,
}

export default function ContentBlocks({ 
  summary, 
  keyPoints, 
  excerptHtml, 
  entities, 
  timeline 
}: ContentBlocksProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false)

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      {summary && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Executive Summary</h2>
          <p className="text-slate-700 leading-relaxed prose prose-slate max-w-none">
            {summary}
          </p>
        </section>
      )}

      {/* Key Points */}
      {keyPoints && keyPoints.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Key Points</h2>
          <ul className="space-y-2">
            {keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-600 font-medium mt-1 flex-shrink-0">•</span>
                <span className="text-slate-700">{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Excerpt / Preview */}
      {excerptHtml && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Article Preview</h2>
          <div 
            className="prose prose-slate max-w-none text-slate-700"
            dangerouslySetInnerHTML={{ 
              __html: showFullExcerpt ? excerptHtml : excerptHtml.substring(0, 1000) + '...'
            }}
          />
          {excerptHtml.length > 1000 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullExcerpt(!showFullExcerpt)}
              className="mt-3"
            >
              {showFullExcerpt ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show More
                </>
              )}
            </Button>
          )}
        </section>
      )}

      {/* Entities */}
      {entities && entities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">People & Organizations</h2>
          <div className="flex flex-wrap gap-2">
            {entities.map((entity, index) => (
              <Badge 
                key={index}
                variant="secondary"
                className="flex items-center gap-1 text-sm"
              >
                <User className="h-3 w-3" />
                {entity}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Timeline</h2>
          <div className="space-y-3">
            {timeline.map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-1 text-sm font-medium text-blue-600 min-w-[80px]">
                  <Calendar className="h-3 w-3" />
                  {item.date}
                </div>
                <div className="text-sm text-slate-700">
                  {item.fact}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// Skeleton component for loading state
ContentBlocks.Skeleton = function Skeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Summary skeleton */}
      <section>
        <div className="h-6 bg-gray-200 rounded w-48 mb-3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        </div>
      </section>

      {/* Key points skeleton */}
      <section>
        <div className="h-6 bg-gray-200 rounded w-32 mb-3"></div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded-full mt-1 flex-shrink-0"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </section>

      {/* Excerpt skeleton */}
      <section>
        <div className="h-6 bg-gray-200 rounded w-40 mb-3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-11/12"></div>
          <div className="h-4 bg-gray-200 rounded w-10/12"></div>
          <div className="h-4 bg-gray-200 rounded w-9/12"></div>
        </div>
      </section>
    </div>
  )
}

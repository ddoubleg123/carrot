'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, User, Calendar, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ContentPaneProps {
  summary: string
  keyFacts: Array<{ text: string; date?: string }>
  context?: string
  entities?: string[]
  excerptHtml?: string
  citations: {
    domain: string
    url: string
    extractedAt: string
  }
  isExcerptAllowed?: boolean
  onEntityClick?: (entity: string) => void
}

export default function ContentPane({
  summary,
  keyFacts,
  context,
  entities,
  excerptHtml,
  citations,
  isExcerptAllowed = true,
  onEntityClick
}: ContentPaneProps) {
  const [showFullExcerpt, setShowFullExcerpt] = useState(false)

  const formatTimestamp = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Executive Summary */}
      {summary && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3 uppercase tracking-wide">
            Executive Summary
          </h2>
          <p className="text-base text-slate-700 leading-relaxed">
            {summary}
          </p>
        </section>
      )}

      {/* Key Facts */}
      {keyFacts && keyFacts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3 uppercase tracking-wide">
            Key Facts
          </h2>
          <ul className="space-y-3">
            {keyFacts.map((fact, index) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">{index + 1}</span>
                <div className="flex-1">
                  <p className="text-slate-700">{fact.text}</p>
                  {fact.date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      <span>{fact.date}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Context & Significance */}
      {context && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3 uppercase tracking-wide">
            Why This Matters
          </h2>
          <p className="text-base text-slate-700 leading-relaxed">
            {context}
          </p>
        </section>
      )}

      {/* Article Excerpt */}
      {isExcerptAllowed && excerptHtml && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900 uppercase tracking-wide">
              Article Preview
            </h2>
            {!isExcerptAllowed && (
              <Badge variant="secondary" className="text-xs">
                Summary Only
              </Badge>
            )}
          </div>
          
          <div 
            className={`prose prose-slate max-w-none text-slate-700 ${!showFullExcerpt ? 'line-clamp-[12]' : ''}`}
            dangerouslySetInnerHTML={{ __html: excerptHtml }}
          />
          
          {excerptHtml.length > 1500 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullExcerpt(!showFullExcerpt)}
              className="mt-3 text-blue-600 hover:text-blue-700"
            >
              {showFullExcerpt ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show More Preview
                </>
              )}
            </Button>
          )}
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>Read the full article on {citations.domain}</strong> – This preview respects fair use.
              </span>
            </p>
          </div>
        </section>
      )}

      {!isExcerptAllowed && (
        <section>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <p className="text-sm text-slate-600 mb-2">
              Full excerpt not available due to site policy.
            </p>
            <Button
              size="sm"
              className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
              onClick={() => window.open(citations.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Read on {citations.domain}
            </Button>
          </div>
        </section>
      )}

      {/* Related Entities */}
      {entities && entities.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3 uppercase tracking-wide">
            Related Entities
          </h2>
          <div className="flex flex-wrap gap-2">
            {entities.map((entity, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => onEntityClick?.(entity)}
              >
                <User className="h-3 w-3" />
                {entity}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Citations */}
      <section className="pt-6 border-t border-slate-200">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <div className="flex-1">
            <p className="mb-1">
              <strong className="text-slate-900">Source:</strong>{' '}
              <a 
                href={citations.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {citations.domain}
              </a>
            </p>
            <p className="text-xs text-slate-500">
              Content extracted {formatTimestamp(citations.extractedAt)}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

// Loading skeleton
export function ContentPaneSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-8 animate-pulse">
      {/* Summary skeleton */}
      <section>
        <div className="h-5 bg-slate-200 rounded w-48 mb-3" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-5/6" />
          <div className="h-4 bg-slate-200 rounded w-4/5" />
        </div>
      </section>

      {/* Key facts skeleton */}
      <section>
        <div className="h-5 bg-slate-200 rounded w-32 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="h-4 w-4 bg-slate-200 rounded-full mt-0.5" />
              <div className="flex-1 h-4 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* Context skeleton */}
      <section>
        <div className="h-5 bg-slate-200 rounded w-40 mb-3" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-full" />
          <div className="h-4 bg-slate-200 rounded w-11/12" />
        </div>
      </section>
    </div>
  )
}

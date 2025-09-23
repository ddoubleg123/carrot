'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, ExternalLink, Copy, Check, Calendar, User, Building } from 'lucide-react'

interface Source {
  id: string
  title: string
  url: string
  author?: string | null
  publisher?: string | null
  publishedAt?: Date | null
  citeMeta?: {
    title: string
    url: string
    author?: string
    publisher?: string
    publishedAt?: string
  } | null
}

interface ReferencesListProps {
  sources: Source[]
}

export default function ReferencesList({ sources }: ReferencesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    if (!searchQuery) return sources

    const query = searchQuery.toLowerCase()
    return sources.filter(source => 
      source.title.toLowerCase().includes(query) ||
      source.author?.toLowerCase().includes(query) ||
      source.publisher?.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query)
    )
  }, [sources, searchQuery])

  // Generate citation text
  const generateCitation = (source: Source): string => {
    const meta = source.citeMeta
    if (!meta) {
      // Fallback citation format
      const parts = []
      if (source.author) parts.push(source.author)
      if (source.publisher) parts.push(source.publisher)
      if (source.publishedAt) parts.push(source.publishedAt.toLocaleDateString())
      parts.push(`"${source.title}"`)
      parts.push(source.url)
      return parts.join('. ')
    }

    // Use citeMeta for proper citation
    const parts = []
    if (meta.author) parts.push(meta.author)
    if (meta.publisher) parts.push(meta.publisher)
    if (meta.publishedAt) parts.push(meta.publishedAt)
    parts.push(`"${meta.title}"`)
    parts.push(meta.url)
    return parts.join('. ')
  }

  // Copy citation to clipboard
  const copyCitation = async (source: Source) => {
    try {
      const citation = generateCitation(source)
      await navigator.clipboard.writeText(citation)
      setCopiedId(source.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy citation:', error)
    }
  }

  // Get domain from URL
  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">References</h2>
        <p className="text-gray-600">All sources and citations used in this patch</p>
      </div>

      {/* Search */}
      <Card className="rounded-2xl border border-gray-200">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredSources.length} of {sources.length} sources
        </p>
      </div>

      {/* Sources List */}
      <div className="space-y-4">
        {filteredSources.length === 0 ? (
          <Card className="rounded-2xl border border-gray-200">
            <CardContent className="p-8 text-center">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No sources found</h3>
              <p className="text-gray-600">
                {searchQuery 
                  ? 'Try adjusting your search terms.'
                  : 'No sources have been added to this patch yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSources.map((source) => (
            <Card key={source.id} className="rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Favicon/Domain indicator */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {getDomain(source.url).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Source content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                          {source.title}
                        </h3>

                        {/* Metadata */}
                        <div className="space-y-2 mb-4">
                          {source.author && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User className="w-4 h-4" />
                              <span>{source.author}</span>
                            </div>
                          )}
                          {source.publisher && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Building className="w-4 h-4" />
                              <span>{source.publisher}</span>
                            </div>
                          )}
                          {source.publishedAt && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{source.publishedAt.toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        {/* URL */}
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="text-xs">
                            {getDomain(source.url)}
                          </Badge>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Source
                          </a>
                        </div>

                        {/* Citation */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 mb-1">Citation:</p>
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {generateCitation(source)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyCitation(source)}
                              className="flex-shrink-0"
                            >
                              {copiedId === source.id ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Export Options */}
      {sources.length > 0 && (
        <Card className="rounded-2xl border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Export References
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Copy className="w-4 h-4 mr-2" />
              Copy All Citations
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <ExternalLink className="w-4 h-4 mr-2" />
              Export as Bibliography
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

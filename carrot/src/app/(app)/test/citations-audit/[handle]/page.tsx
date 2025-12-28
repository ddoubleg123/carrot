'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Citation {
  id: string
  url: string
  title: string | null
  context: string | null
  sourceNumber: number
  wikipediaPage: {
    title: string
    url: string
  }
  relevance: {
    score: number | null
    decision: 'saved' | 'denied' | null
    status: string
    verificationStatus: string
  }
  extraction: {
    status: 'success' | 'error' | 'pending' | 'not_saved'
    error: string | null
    hasContent: boolean
    contentLength: number
  }
  saved: {
    savedContentId: string | null
    hasSavedContent: boolean
    savedContentTitle: string | null
    textContentLength: number
    hasTextContent: boolean
    savedAt: string | null
    lastCrawledAt: string | null
  }
  agentLearning: {
    hasMemory: boolean
    memoryId: string | null
    learnedAt: string | null
  }
  timestamps: {
    createdAt: string
    lastScannedAt: string | null
  }
}

interface AuditData {
  patch: {
    id: string
    title: string
    handle: string
  }
  summary: {
    total: number
    scanned: number
    saved: number
    extracted: number
    withMemory: number
    withErrors: number
    withScore: number
    avgScore: number
    scanRate: number
    saveRate: number
    extractionRate: number
    learningRate: number
  }
  citations: Citation[]
}

export default function CitationsAuditPage() {
  const params = useParams()
  const handle = params?.handle as string | undefined
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'saved' | 'extracted' | 'errors' | 'withMemory'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'created' | 'scanned'>('score')

  useEffect(() => {
    if (!handle) {
      setError('Missing patch handle')
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        const response = await fetch(`/api/patches/${handle}/citations-audit`)
        if (!response.ok) {
          throw new Error('Failed to fetch citations audit')
        }
        const auditData = await response.json()
        setData(auditData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [handle])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading citations audit...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Filter citations
  let filteredCitations = data.citations
  if (filter === 'saved') {
    filteredCitations = data.citations.filter(c => c.saved.savedContentId !== null)
  } else if (filter === 'extracted') {
    filteredCitations = data.citations.filter(c => c.extraction.status === 'success')
  } else if (filter === 'errors') {
    filteredCitations = data.citations.filter(c => c.extraction.status === 'error')
  } else if (filter === 'withMemory') {
    filteredCitations = data.citations.filter(c => c.agentLearning.hasMemory)
  }

  // Sort citations
  filteredCitations = [...filteredCitations].sort((a, b) => {
    if (sortBy === 'score') {
      const scoreA = a.relevance.score ?? 0
      const scoreB = b.relevance.score ?? 0
      return scoreB - scoreA
    } else if (sortBy === 'created') {
      return new Date(b.timestamps.createdAt).getTime() - new Date(a.timestamps.createdAt).getTime()
    } else {
      const scannedA = a.timestamps.lastScannedAt ? new Date(a.timestamps.lastScannedAt).getTime() : 0
      const scannedB = b.timestamps.lastScannedAt ? new Date(b.timestamps.lastScannedAt).getTime() : 0
      return scannedB - scannedA
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'not_saved': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500'
    if (score >= 70) return 'text-green-600 font-semibold'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Citations Audit: {data.patch.title}
          </h1>
          <p className="text-gray-600">Patch Handle: {data.patch.handle}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Citations</div>
            <div className="text-3xl font-bold text-gray-900">{data.summary.total}</div>
            <div className="text-sm text-gray-500 mt-1">
              {data.summary.scanRate}% scanned
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Saved</div>
            <div className="text-3xl font-bold text-blue-600">{data.summary.saved}</div>
            <div className="text-sm text-gray-500 mt-1">
              {data.summary.saveRate}% of scanned
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Extracted</div>
            <div className="text-3xl font-bold text-green-600">{data.summary.extracted}</div>
            <div className="text-sm text-gray-500 mt-1">
              {data.summary.extractionRate}% of saved
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Agent Memories</div>
            <div className="text-3xl font-bold text-purple-600">{data.summary.withMemory}</div>
            <div className="text-sm text-gray-500 mt-1">
              {data.summary.learningRate}% of saved
            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Filter:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Citations</option>
                <option value="saved">Saved Only</option>
                <option value="extracted">Extracted Only</option>
                <option value="errors">Errors Only</option>
                <option value="withMemory">With Agent Memory</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="score">Relevance Score</option>
                <option value="created">Created Date</option>
                <option value="scanned">Last Scanned</option>
              </select>
            </div>
            
            <div className="ml-auto text-sm text-gray-600">
              Showing {filteredCitations.length} of {data.citations.length} citations
            </div>
          </div>
        </div>

        {/* Citations Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Citation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Relevance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extraction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saved
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent Learning
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCitations.map((citation) => (
                  <tr key={citation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {citation.title || 'Untitled'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Source #{citation.sourceNumber} from {citation.wikipediaPage.title}
                        </div>
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 block truncate max-w-md"
                        >
                          {citation.url}
                        </a>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className={`font-medium ${getScoreColor(citation.relevance.score)}`}>
                          {citation.relevance.score !== null 
                            ? `${citation.relevance.score.toFixed(1)}`
                            : 'No score'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {citation.relevance.decision || 'No decision'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {citation.relevance.status}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(citation.extraction.status)}`}>
                          {citation.extraction.status}
                        </span>
                        {citation.extraction.error && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={citation.extraction.error}>
                            {citation.extraction.error}
                          </div>
                        )}
                        {citation.extraction.hasContent && (
                          <div className="text-xs text-gray-500 mt-1">
                            {citation.extraction.contentLength.toLocaleString()} chars
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {citation.saved.savedContentId ? (
                          <>
                            <div className="text-green-600 font-medium">✅ Saved</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {citation.saved.hasTextContent 
                                ? `${citation.saved.textContentLength.toLocaleString()} chars`
                                : 'No text content'}
                            </div>
                            {citation.saved.savedAt && (
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(citation.saved.savedAt).toLocaleDateString()}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-400">Not saved</div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {citation.agentLearning.hasMemory ? (
                          <>
                            <div className="text-purple-600 font-medium">✅ Learned</div>
                            {citation.agentLearning.learnedAt && (
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(citation.agentLearning.learnedAt).toLocaleDateString()}
                              </div>
                            )}
                          </>
                        ) : citation.saved.savedContentId ? (
                          <div className="text-yellow-600">⏳ Pending</div>
                        ) : (
                          <div className="text-gray-400">—</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredCitations.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No citations match the current filter.
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * Test page showing all extracted URLs AND stored data from database
 * Access at: /test/extraction
 * 
 * Table format with filtering capabilities
 */

'use client'

import { useEffect, useState, useMemo } from 'react'

interface StoredCitation {
  id: string
  url: string
  title?: string
  context?: string
  sourceNumber?: number
  referenceNumber?: number
  contentText?: string
  contentLength: number
  aiScore?: number
  scanStatus: string
  relevanceDecision?: string
  verificationStatus: string
  savedContentId?: string
  savedMemoryId?: string
  errorMessage?: string
  fromWikipediaPage: string
  fromWikipediaUrl?: string
  lastScannedAt?: string
  createdAt: string
  isWikipediaInternal?: boolean
}

type SortField = 'url' | 'fromWikipediaPage' | 'scanStatus' | 'verificationStatus' | 'relevanceDecision' | 'aiScore' | 'contentLength' | 'createdAt'
type SortDirection = 'asc' | 'desc'

export default function ExtractionTestPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterScanStatus, setFilterScanStatus] = useState<string>('all')
  const [filterVerificationStatus, setFilterVerificationStatus] = useState<string>('all')
  const [filterRelevanceDecision, setFilterRelevanceDecision] = useState<string>('all')
  const [filterUrlType, setFilterUrlType] = useState<string>('all') // 'all', 'external', 'wikipedia'
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [liveEvents, setLiveEvents] = useState<Array<{ timestamp: number; type: string; data: any }>>([])
  const [showLiveTracker, setShowLiveTracker] = useState(false)
  const [lastEventTime, setLastEventTime] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [showDashboard, setShowDashboard] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/test/extraction/stats')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setStats(result)
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }

    fetchStats()
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/test/extraction')

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`)
        }

        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch data')
        }
        
        setData(result)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }

    fetchData()
    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  // Live tracker polling
  useEffect(() => {
    if (!showLiveTracker) return

    const pollLiveEvents = async () => {
      try {
        const response = await fetch(`/api/test/extraction/live?sessionId=default&since=${lastEventTime}`)
        if (response.ok) {
          const result = await response.json()
          if (result.events && result.events.length > 0) {
            setLiveEvents(prev => [...prev, ...result.events])
            setLastEventTime(result.lastEventTime || Date.now())
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }

    const interval = setInterval(pollLiveEvents, 1000) // Poll every second
    pollLiveEvents() // Initial fetch

    return () => clearInterval(interval)
  }, [showLiveTracker, lastEventTime])

  // Get all citations (external + Wikipedia internal)
  const allCitations = useMemo(() => {
    if (!data?.stored?.citations) return []
    return (data.stored.citations as StoredCitation[]).map(cit => ({
      ...cit,
      isWikipediaInternal: cit.url.includes('wikipedia.org') || cit.url.startsWith('./') || cit.url.startsWith('/wiki/')
    }))
  }, [data])

  // Filter citations
  const filteredCitations = useMemo(() => {
    let filtered = [...allCitations]

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(cit =>
        cit.url.toLowerCase().includes(searchLower) ||
        (cit.title || '').toLowerCase().includes(searchLower) ||
        (cit.context || '').toLowerCase().includes(searchLower) ||
        cit.fromWikipediaPage.toLowerCase().includes(searchLower)
      )
    }

    // URL type filter
    if (filterUrlType === 'external') {
      filtered = filtered.filter(cit => !cit.isWikipediaInternal)
    } else if (filterUrlType === 'wikipedia') {
      filtered = filtered.filter(cit => cit.isWikipediaInternal)
    }

    // Scan status filter
    if (filterScanStatus !== 'all') {
      filtered = filtered.filter(cit => cit.scanStatus === filterScanStatus)
    }

    // Verification status filter
    if (filterVerificationStatus !== 'all') {
      filtered = filtered.filter(cit => cit.verificationStatus === filterVerificationStatus)
    }

    // Relevance decision filter
    if (filterRelevanceDecision !== 'all') {
      if (filterRelevanceDecision === 'none') {
        filtered = filtered.filter(cit => !cit.relevanceDecision)
      } else {
        filtered = filtered.filter(cit => cit.relevanceDecision === filterRelevanceDecision)
      }
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (sortField) {
        case 'url':
          aVal = a.url.toLowerCase()
          bVal = b.url.toLowerCase()
          break
        case 'fromWikipediaPage':
          aVal = a.fromWikipediaPage.toLowerCase()
          bVal = b.fromWikipediaPage.toLowerCase()
          break
        case 'scanStatus':
          aVal = a.scanStatus
          bVal = b.scanStatus
          break
        case 'verificationStatus':
          aVal = a.verificationStatus
          bVal = b.verificationStatus
          break
        case 'relevanceDecision':
          aVal = a.relevanceDecision || ''
          bVal = b.relevanceDecision || ''
          break
        case 'aiScore':
          aVal = a.aiScore ?? -1
          bVal = b.aiScore ?? -1
          break
        case 'contentLength':
          aVal = a.contentLength
          bVal = b.contentLength
          break
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime()
          bVal = new Date(b.createdAt).getTime()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [allCitations, searchTerm, filterScanStatus, filterVerificationStatus, filterRelevanceDecision, filterUrlType, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getStatusBadge = (status: string, type: 'scan' | 'verification' | 'decision') => {
    const colors: Record<string, { bg: string; text: string }> = {
      scanned: { bg: '#28a745', text: 'white' },
      not_scanned: { bg: '#ffc107', text: 'white' },
      scanning: { bg: '#17a2b8', text: 'white' },
      verified: { bg: '#28a745', text: 'white' },
      failed: { bg: '#dc3545', text: 'white' },
      pending: { bg: '#6c757d', text: 'white' },
      saved: { bg: '#28a745', text: 'white' },
      denied: { bg: '#dc3545', text: 'white' }
    }
    
    const color = colors[status] || { bg: '#6c757d', text: 'white' }
    
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600',
        background: color.bg,
        color: color.text,
        textTransform: 'capitalize'
      }}>
        {status || 'N/A'}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>Loading extraction test...</h1>
        <p>Fetching data from database...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px' }}>
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    )
  }

  if (!data) return null

  // Get unique values for filters
  const uniqueScanStatuses = Array.from(new Set(allCitations.map(c => c.scanStatus))).sort()
  const uniqueVerificationStatuses = Array.from(new Set(allCitations.map(c => c.verificationStatus))).sort()
  const uniqueRelevanceDecisions = Array.from(new Set(allCitations.map(c => c.relevanceDecision || 'none').filter(Boolean))).sort()

  return (
    <div style={{ maxWidth: '1800px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '30px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0' }}>📊 Citation Processing Dashboard</h1>
            <p style={{ margin: 0 }}><strong>Patch:</strong> {stats?.patch?.title || 'Israel'}</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
              <strong>Last Updated:</strong> {stats?.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'Loading...'}
              {autoRefresh && <span style={{ marginLeft: '10px', color: '#28a745' }}>🔄 Auto-refreshing every 5s</span>}
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              style={{
                padding: '8px 16px',
                background: showDashboard ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginRight: '10px',
                fontSize: '14px'
              }}
            >
              {showDashboard ? '📊 Dashboard' : '📋 Table View'}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                padding: '8px 16px',
                background: autoRefresh ? '#17a2b8' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {autoRefresh ? '⏸️ Pause' : '▶️ Auto-refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Dashboard */}
      {showDashboard && stats && (
        <div style={{ marginBottom: '20px' }}>
          {/* Processing Progress */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>📈 Processing Progress</h2>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Overall Progress</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>{stats.citations.progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '30px', background: '#e9ecef', borderRadius: '15px', overflow: 'hidden' }}>
                <div style={{
                  width: `${stats.citations.progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #28a745, #20c997)',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {stats.citations.scanned.toLocaleString()} / {stats.citations.total.toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Citations</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0066cc' }}>{stats.citations.total.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Processed</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#17a2b8' }}>{stats.citations.scanned.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>✅ Saved</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>{stats.citations.saved.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>{stats.citations.processingRate} save rate</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>❌ Denied</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545' }}>{stats.citations.denied.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>⏳ Pending</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc107' }}>{stats.citations.pending.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>📄 With Content</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#6c757d' }}>{stats.citations.withContent.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Agent Learning Stats */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>🤖 Agent Learning</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Memories</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0066cc' }}>{stats.agent.totalMemories.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>From Discovery</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>{stats.agent.discoveryMemories.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Feed Queue - Queued</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc107' }}>{stats.agent.feedQueue.queued.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Feed Queue - Done</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>{stats.agent.feedQueue.done.toLocaleString()}</div>
              </div>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Feed Queue - Failed</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545' }}>{stats.agent.feedQueue.failed.toLocaleString()}</div>
              </div>
            </div>
            
            {/* Recent Memories */}
            {stats.agent.recentMemories.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Recent Agent Memories</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                  {stats.agent.recentMemories.map((memory: any, idx: number) => (
                    <div key={idx} style={{ padding: '12px', background: '#f8f9fa', borderRadius: '6px', borderLeft: '4px solid #28a745' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <strong style={{ fontSize: '14px' }}>{memory.title || 'Untitled'}</strong>
                        <span style={{ fontSize: '12px', color: '#666' }}>{new Date(memory.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                        {memory.url.substring(0, 80)}...
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {memory.contentLength.toLocaleString()} chars • {memory.preview.substring(0, 100)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Saved Content */}
          {stats.discoveredContent.recent.length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>
                💾 Discovered Content ({stats.discoveredContent.total} total, {stats.discoveredContent.withHero} with heroes)
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {stats.discoveredContent.recent.map((content: any, idx: number) => (
                  <div key={idx} style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px', borderLeft: '4px solid #28a745' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong style={{ fontSize: '14px' }}>{content.title}</strong>
                      <span style={{ fontSize: '12px', color: '#666' }}>{new Date(content.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                      {content.url.substring(0, 80)}...
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>
                      {content.contentLength.toLocaleString()} chars • {content.summary?.substring(0, 100) || 'No summary'}...
                    </div>
                    <div style={{ fontSize: '11px', color: content.hasHero ? '#28a745' : '#999' }}>
                      {content.hasHero ? '✅ Has hero image' : '⏳ No hero image yet'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Saved Citations */}
          {stats.citations.recentSaved.length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>✅ Recently Saved Citations</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {stats.citations.recentSaved.map((citation: any, idx: number) => (
                  <div key={idx} style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px', borderLeft: '4px solid #28a745' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <strong style={{ fontSize: '14px' }}>{citation.title || 'Untitled'}</strong>
                      <span style={{ fontSize: '12px', color: '#666' }}>{citation.scannedAt ? new Date(citation.scannedAt).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                      {citation.url.substring(0, 80)}...
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      Score: {citation.score || 'N/A'} • {citation.contentLength.toLocaleString()} chars • Saved as: {citation.savedContentId || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Tracker Toggle */}
      <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <button
          onClick={() => setShowLiveTracker(!showLiveTracker)}
          style={{
            padding: '10px 20px',
            background: showLiveTracker ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          {showLiveTracker ? '⏸️ Stop Live Tracker' : '▶️ Start Live Tracker'}
        </button>
        {showLiveTracker && (
          <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '6px', maxHeight: '400px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>📡 Live Extraction Events ({liveEvents.length})</h3>
            {liveEvents.length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic' }}>Waiting for extraction events...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {liveEvents.slice(-50).reverse().map((event, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px',
                      background: 'white',
                      borderRadius: '4px',
                      borderLeft: '4px solid',
                      borderLeftColor: event.type.includes('error') ? '#dc3545' :
                                     event.type.includes('complete') ? '#28a745' :
                                     event.type.includes('started') ? '#0066cc' : '#17a2b8',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: '#0066cc' }}>{event.type}</strong>
                      <span style={{ color: '#999' }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre style={{ margin: 0, fontSize: '11px', color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #0066cc' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Total Citations</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0066cc' }}>{allCitations.length}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #28a745' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>External URLs</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>{allCitations.filter(c => !c.isWikipediaInternal).length}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #17a2b8' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Wikipedia Internal</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#17a2b8' }}>{allCitations.filter(c => c.isWikipediaInternal).length}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #ffc107' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Scanned</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffc107' }}>{allCitations.filter(c => c.scanStatus === 'scanned').length}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #dc3545' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>With Content</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc3545' }}>{allCitations.filter(c => c.contentLength > 0).length}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #6c757d' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Saved</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6c757d' }}>{allCitations.filter(c => c.savedContentId).length}</div>
        </div>
      </div>

      {/* Table View - Only show when dashboard is hidden */}
      {!showDashboard && (
        <>
      {/* Filters */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Search</label>
            <input
              type="text"
              placeholder="Search URLs, titles, context..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>URL Type</label>
            <select
              value={filterUrlType}
              onChange={(e) => setFilterUrlType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="all">All URLs</option>
              <option value="external">External URLs Only</option>
              <option value="wikipedia">Wikipedia Internal Only</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Scan Status</label>
            <select
              value={filterScanStatus}
              onChange={(e) => setFilterScanStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="all">All</option>
              {uniqueScanStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Verification Status</label>
            <select
              value={filterVerificationStatus}
              onChange={(e) => setFilterVerificationStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="all">All</option>
              {uniqueVerificationStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Relevance Decision</label>
            <select
              value={filterRelevanceDecision}
              onChange={(e) => setFilterRelevanceDecision(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="all">All</option>
              <option value="none">No Decision</option>
              {uniqueRelevanceDecisions.map(decision => (
                <option key={decision} value={decision}>{decision}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Showing <strong>{filteredCitations.length}</strong> of <strong>{allCitations.length}</strong> citations
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflowX: 'auto', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fa' }}>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('url')}>
                URL {sortField === 'url' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('fromWikipediaPage')}>
                Reference Wikipedia Page {sortField === 'fromWikipediaPage' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Ref #</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('scanStatus')}>
                Scan Status {sortField === 'scanStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('verificationStatus')}>
                Verification {sortField === 'verificationStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('relevanceDecision')}>
                Decision {sortField === 'relevanceDecision' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('aiScore')}>
                AI Score {sortField === 'aiScore' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer' }} onClick={() => handleSort('contentLength')}>
                Data Extracted {sortField === 'contentLength' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCitations.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                  No citations found. {searchTerm || filterScanStatus !== 'all' || filterVerificationStatus !== 'all' || filterRelevanceDecision !== 'all' || filterUrlType !== 'all' ? 'Try adjusting your filters.' : 'Citations will appear here once they are extracted and stored.'}
                </td>
              </tr>
            ) : (
              filteredCitations.map((cit: StoredCitation) => (
                <>
                  <tr
                    key={cit.id}
                    style={{
                      borderBottom: '1px solid #dee2e6',
                      cursor: 'pointer',
                      background: expandedRow === cit.id ? '#f8f9fa' : 'white'
                    }}
                    onClick={() => setExpandedRow(expandedRow === cit.id ? null : cit.id)}
                  >
                    <td style={{ padding: '12px', maxWidth: '300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cit.isWikipediaInternal && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: '600',
                            background: '#17a2b8',
                            color: 'white'
                          }}>
                            WIKI
                          </span>
                        )}
                        <a
                          href={cit.url.startsWith('./') || cit.url.startsWith('/wiki/') 
                            ? `https://en.wikipedia.org/wiki/${cit.url.replace('./', '').replace('/wiki/', '')}`
                            : cit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: '#0066cc',
                            textDecoration: 'none',
                            wordBreak: 'break-all',
                            fontSize: '13px'
                          }}
                        >
                          {cit.url.length > 60 ? cit.url.substring(0, 60) + '...' : cit.url}
                        </a>
                      </div>
                      {cit.title && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          {cit.title.length > 50 ? cit.title.substring(0, 50) + '...' : cit.title}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', maxWidth: '200px' }}>
                      {cit.fromWikipediaUrl ? (
                        <a
                          href={cit.fromWikipediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: '#0066cc',
                            textDecoration: 'none',
                            fontSize: '13px'
                          }}
                        >
                          {cit.fromWikipediaPage.length > 30 ? cit.fromWikipediaPage.substring(0, 30) + '...' : cit.fromWikipediaPage}
                        </a>
                      ) : (
                        <span style={{ fontSize: '13px' }}>
                          {cit.fromWikipediaPage.length > 30 ? cit.fromWikipediaPage.substring(0, 30) + '...' : cit.fromWikipediaPage}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {cit.referenceNumber || cit.sourceNumber || '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {getStatusBadge(cit.scanStatus, 'scan')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {getStatusBadge(cit.verificationStatus, 'verification')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {cit.relevanceDecision ? getStatusBadge(cit.relevanceDecision, 'decision') : <span style={{ color: '#999' }}>Pending</span>}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {cit.aiScore !== null && cit.aiScore !== undefined ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: cit.aiScore >= 60 ? '#28a745' : cit.aiScore >= 40 ? '#ffc107' : '#dc3545',
                          color: 'white'
                        }}>
                          {cit.aiScore}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {cit.contentLength > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedRow(expandedRow === cit.id ? null : cit.id)
                          }}
                          style={{
                            padding: '4px 12px',
                            background: '#0066cc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {cit.contentLength.toLocaleString()} chars
                        </button>
                      ) : (
                        <span style={{ color: '#999' }}>No data</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm(`Manually verify and process: ${cit.url}?\n\nThis will trigger content extraction and AI scoring.`)) {
                            return
                          }
                          
                          try {
                            const response = await fetch('/api/test/extraction/verify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ citationId: cit.id })
                            })
                            
                            const result = await response.json()
                            
                            if (result.success) {
                              alert(`✅ Citation processed successfully!\n\nStatus: ${result.citation?.scanStatus}\nAI Score: ${result.citation?.aiScore || 'N/A'}\nContent: ${result.citation?.contentLength || 0} chars`)
                              // Reload page to show updated data
                              window.location.reload()
                            } else {
                              alert(`❌ Failed to process citation:\n${result.error || 'Unknown error'}`)
                            }
                          } catch (err) {
                            alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
                          }
                        }}
                        style={{
                          padding: '4px 12px',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        Verify
                      </button>
                    </td>
                  </tr>
                  {expandedRow === cit.id && (
                    <tr>
                      <td colSpan={9} style={{ padding: '20px', background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>Full URL</h4>
                            <a
                              href={cit.url.startsWith('./') || cit.url.startsWith('/wiki/') 
                                ? `https://en.wikipedia.org/wiki/${cit.url.replace('./', '').replace('/wiki/', '')}`
                                : cit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#0066cc',
                                textDecoration: 'none',
                                wordBreak: 'break-all',
                                fontSize: '13px',
                                display: 'block',
                                marginBottom: '15px'
                              }}
                            >
                              {cit.url}
                            </a>
                            
                            {cit.title && (
                              <>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>Title</h4>
                                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#333' }}>{cit.title}</p>
                              </>
                            )}
                            
                            {cit.context && (
                              <>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>Context</h4>
                                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>{cit.context}</p>
                              </>
                            )}
                          </div>
                          <div>
                            {cit.contentText && cit.contentLength > 0 && (
                              <>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>
                                  Extracted Content ({cit.contentLength.toLocaleString()} characters)
                                </h4>
                                <div style={{
                                  padding: '15px',
                                  background: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #ddd',
                                  maxHeight: '400px',
                                  overflow: 'auto',
                                  fontSize: '13px',
                                  lineHeight: '1.6',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}>
                                  {cit.contentText}
                                </div>
                              </>
                            )}
                            
                            {cit.errorMessage && (
                              <>
                                <h4 style={{ margin: '15px 0 10px 0', fontSize: '14px', fontWeight: '600', color: '#dc3545' }}>Error</h4>
                                <p style={{ margin: '0', fontSize: '13px', color: '#dc3545' }}>{cit.errorMessage}</p>
                              </>
                            )}
                            
                            <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                              <div><strong>Created:</strong> {new Date(cit.createdAt).toLocaleString()}</div>
                              {cit.lastScannedAt && (
                                <div><strong>Last Scanned:</strong> {new Date(cit.lastScannedAt).toLocaleString()}</div>
                              )}
                              {cit.savedContentId && (
                                <div><strong>Saved Content ID:</strong> {cit.savedContentId}</div>
                              )}
                              {cit.savedMemoryId && (
                                <div><strong>Saved Memory ID:</strong> {cit.savedMemoryId}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  )
}

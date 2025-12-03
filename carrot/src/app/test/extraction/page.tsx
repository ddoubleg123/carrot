/**
 * Test page showing all extracted URLs AND stored data from database
 * Access at: /test/extraction
 */

'use client'

import { useEffect, useState } from 'react'

interface StoredCitation {
  id: string
  url: string
  title?: string
  context?: string
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
  lastScannedAt?: string
  createdAt: string
}

interface ExtractedUrl {
  url: string
  title?: string
  context?: string
}

export default function ExtractionTestPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'extracted' | 'stored' | 'content' | 'memories'>('stored')

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
  }, [])

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

  // Separate external vs Wikipedia citations
  const externalCitations = (data.stored?.citations || []).filter((cit: StoredCitation) => 
    !cit.url.includes('wikipedia.org')
  )
  const wikipediaCitations = (data.stored?.citations || []).filter((cit: StoredCitation) => 
    cit.url.includes('wikipedia.org')
  )

  // Filter stored citations (prioritize external)
  const filteredExternal = externalCitations.filter((cit: StoredCitation) => {
    const searchLower = searchTerm.toLowerCase()
    return cit.url.toLowerCase().includes(searchLower) ||
           (cit.title || '').toLowerCase().includes(searchLower) ||
           (cit.context || '').toLowerCase().includes(searchLower) ||
           (cit.fromWikipediaPage || '').toLowerCase().includes(searchLower)
  })
  const filteredWikipedia = wikipediaCitations.filter((cit: StoredCitation) => {
    const searchLower = searchTerm.toLowerCase()
    return cit.url.toLowerCase().includes(searchLower) ||
           (cit.title || '').toLowerCase().includes(searchLower) ||
           (cit.context || '').toLowerCase().includes(searchLower) ||
           (cit.fromWikipediaPage || '').toLowerCase().includes(searchLower)
  })
  
  // Prioritize external citations
  const filteredStored = [...filteredExternal, ...filteredWikipedia]

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '30px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>📊 Wikipedia Extraction & Database Test</h1>
        <p><strong>Patch:</strong> Israel</p>
        <p><strong>Last Updated:</strong> {new Date().toISOString()}</p>
      </div>

      {/* Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #0066cc' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Extracted URLs</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0066cc' }}>{data.stats?.extracted?.total || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #28a745' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Stored Citations</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>{data.stats?.stored?.citations || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #ffc107' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Scanned</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffc107' }}>{data.stats?.stored?.scanned || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #dc3545' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>With Content</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc3545' }}>{data.stats?.stored?.withContent || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #17a2b8' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Saved</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#17a2b8' }}>{data.stats?.stored?.saved || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #6c757d' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Discovered Content</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6c757d' }}>{data.stats?.discoveredContent || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #ddd' }}>
        <button
          onClick={() => setActiveTab('stored')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'stored' ? '#0066cc' : '#f8f9fa',
            color: activeTab === 'stored' ? 'white' : '#333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: activeTab === 'stored' ? 'bold' : 'normal'
          }}
        >
          Stored Citations ({data.stats?.stored?.citations || 0})
        </button>
        <button
          onClick={() => setActiveTab('extracted')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'extracted' ? '#0066cc' : '#f8f9fa',
            color: activeTab === 'extracted' ? 'white' : '#333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: activeTab === 'extracted' ? 'bold' : 'normal'
          }}
        >
          Extracted URLs ({data.stats?.extracted?.total || 0})
        </button>
        <button
          onClick={() => setActiveTab('content')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'content' ? '#0066cc' : '#f8f9fa',
            color: activeTab === 'content' ? 'white' : '#333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: activeTab === 'content' ? 'bold' : 'normal'
          }}
        >
          Discovered Content ({data.stats?.discoveredContent || 0})
        </button>
        <button
          onClick={() => setActiveTab('memories')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: activeTab === 'memories' ? '#0066cc' : '#f8f9fa',
            color: activeTab === 'memories' ? 'white' : '#333',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: activeTab === 'memories' ? 'bold' : 'normal'
          }}
        >
          Agent Memories ({data.stats?.agentMemories || 0})
        </button>
      </div>

      {/* Search */}
      <div style={{ margin: '20px 0', padding: '15px', background: 'white', borderRadius: '8px' }}>
        <input
          type="text"
          placeholder="Search URLs, titles, content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '6px'
          }}
        />
      </div>

      {/* Stored Citations Tab */}
      {activeTab === 'stored' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #0066cc', paddingBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>
              Stored Citations from Database ({filteredStored.length})
            </h2>
            <div style={{ fontSize: '14px', color: '#666' }}>
              <span style={{ color: '#28a745', fontWeight: 'bold' }}>{filteredExternal.length} External</span>
              {' | '}
              <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{filteredWikipedia.length} Wikipedia</span>
            </div>
          </div>
          {filteredStored.length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No citations found. {searchTerm ? 'Try a different search term.' : 'Citations will appear here once they are extracted and stored.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {filteredStored.map((cit: StoredCitation) => (
                <div
                  key={cit.id}
                  style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${
                      cit.relevanceDecision === 'saved' ? '#28a745' :
                      cit.relevanceDecision === 'denied' ? '#dc3545' :
                      cit.scanStatus === 'scanned' ? '#ffc107' :
                      '#6c757d'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <a
                        href={cit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#0066cc',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          display: 'block',
                          marginBottom: '8px'
                        }}
                      >
                        {cit.url}
                      </a>
                      {cit.title && (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                          <strong>Title:</strong> {cit.title}
                        </div>
                      )}
                      {cit.context && (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                          <strong>Context:</strong> {cit.context.substring(0, 200)}{cit.context.length > 200 ? '...' : ''}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
                        <strong>From Wikipedia:</strong> {cit.fromWikipediaPage}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: cit.scanStatus === 'scanned' ? '#28a745' : '#ffc107',
                        color: 'white'
                      }}>
                        {cit.scanStatus}
                      </span>
                      {cit.relevanceDecision && (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: cit.relevanceDecision === 'saved' ? '#28a745' : '#dc3545',
                          color: 'white'
                        }}>
                          {cit.relevanceDecision}
                        </span>
                      )}
                      {cit.aiScore !== null && cit.aiScore !== undefined && (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: cit.aiScore >= 60 ? '#28a745' : '#ffc107',
                          color: 'white'
                        }}>
                          Score: {cit.aiScore}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content Text */}
                  {cit.contentText && cit.contentLength > 0 && (
                    <div style={{
                      marginTop: '15px',
                      padding: '15px',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid #ddd'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        <strong>Extracted Content:</strong> {cit.contentLength} characters
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#333',
                        lineHeight: '1.6',
                        maxHeight: '200px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {cit.contentText}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ marginTop: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: '#666' }}>
                    {cit.verificationStatus && (
                      <span><strong>Verification:</strong> {cit.verificationStatus}</span>
                    )}
                    {cit.savedContentId && (
                      <span><strong>Content ID:</strong> {cit.savedContentId}</span>
                    )}
                    {cit.savedMemoryId && (
                      <span><strong>Memory ID:</strong> {cit.savedMemoryId}</span>
                    )}
                    {cit.errorMessage && (
                      <span style={{ color: '#dc3545' }}><strong>Error:</strong> {cit.errorMessage}</span>
                    )}
                    {cit.lastScannedAt && (
                      <span><strong>Scanned:</strong> {new Date(cit.lastScannedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extracted URLs Tab */}
      {activeTab === 'extracted' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', borderBottom: '2px solid #0066cc', paddingBottom: '10px' }}>
            Extracted URLs (Not Yet Stored) ({data.extracted?.urls?.length || 0})
          </h2>
          {Object.entries(data.extracted?.bySection || {}).map(([section, urls]: [string, any]) => (
            <div key={section} style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>
                {section} ({urls.length} URLs)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {urls.filter((cit: ExtractedUrl) => {
                  const searchLower = searchTerm.toLowerCase()
                  return cit.url.toLowerCase().includes(searchLower) ||
                         (cit.title || '').toLowerCase().includes(searchLower) ||
                         (cit.context || '').toLowerCase().includes(searchLower)
                }).map((cit: ExtractedUrl, idx: number) => {
                  const isWikipedia = cit.url.includes('wikipedia.org')
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        borderLeft: `4px solid ${isWikipedia ? '#0066cc' : '#ffc107'}`
                      }}
                    >
                      <a
                        href={cit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#0066cc',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          display: 'block',
                          marginBottom: '8px'
                        }}
                      >
                        {cit.url}
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          marginLeft: '10px',
                          background: isWikipedia ? '#0066cc' : '#ffc107',
                          color: 'white'
                        }}>
                          {isWikipedia ? 'Wikipedia' : 'External'}
                        </span>
                      </a>
                      {cit.title && (
                        <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                          <strong>Title:</strong> {cit.title}
                        </div>
                      )}
                      {cit.context && cit.context !== cit.title && (
                        <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                          <strong>Context:</strong> {cit.context.substring(0, 150)}{cit.context.length > 150 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discovered Content Tab */}
      {activeTab === 'content' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', borderBottom: '2px solid #0066cc', paddingBottom: '10px' }}>
            Discovered Content ({data.stored?.discoveredContent?.length || 0})
          </h2>
          {data.stored?.discoveredContent?.length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No discovered content yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {data.stored.discoveredContent.map((item: any) => (
                <div
                  key={item.id}
                  style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    borderLeft: '4px solid #28a745'
                  }}
                >
                  <a
                    href={item.canonicalUrl || item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#0066cc',
                      textDecoration: 'none',
                      display: 'block',
                      marginBottom: '10px'
                    }}
                  >
                    {item.title}
                  </a>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px', wordBreak: 'break-all' }}>
                    {item.canonicalUrl || item.sourceUrl}
                  </div>
                  {item.summary && (
                    <div style={{ fontSize: '14px', color: '#333', marginTop: '10px', padding: '10px', background: 'white', borderRadius: '6px' }}>
                      <strong>Summary:</strong> {item.summary}
                    </div>
                  )}
                  {item.content && (
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '10px', padding: '10px', background: 'white', borderRadius: '6px', maxHeight: '200px', overflow: 'auto' }}>
                      <strong>Content:</strong> {item.content.substring(0, 500)}{item.content.length > 500 ? '...' : ''}
                    </div>
                  )}
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                    Relevance: {item.relevanceScore} | Quality: {item.qualityScore} | Created: {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent Memories Tab */}
      {activeTab === 'memories' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', borderBottom: '2px solid #0066cc', paddingBottom: '10px' }}>
            Agent Memories ({data.stored?.agentMemories?.length || 0})
          </h2>
          {data.stored?.agentMemories?.length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No agent memories yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {data.stored.agentMemories.map((memory: any) => (
                <div
                  key={memory.id}
                  style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    borderLeft: '4px solid #17a2b8'
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>
                    {memory.sourceTitle}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px', wordBreak: 'break-all' }}>
                    {memory.sourceUrl}
                  </div>
                  {memory.content && (
                    <div style={{
                      fontSize: '13px',
                      color: '#333',
                      marginTop: '10px',
                      padding: '15px',
                      background: 'white',
                      borderRadius: '6px',
                      maxHeight: '300px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {memory.content}
                    </div>
                  )}
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                    Created: {new Date(memory.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

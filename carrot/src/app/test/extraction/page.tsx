/**
 * Test page showing all extracted URLs from Wikipedia
 * Access at: /test/extraction
 */

'use client'

import { useEffect, useState } from 'react'

interface ExtractedUrl {
  url: string
  title?: string
  context?: string
  text?: string
}

export default function ExtractionTestPage() {
  const [urls, setUrls] = useState<ExtractedUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function fetchExtractedUrls() {
      try {
        // Fetch from our API route
        const response = await fetch('/api/test/extraction')

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`)
        }

        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to extract URLs')
        }
        
        setUrls(data.urls || [])
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }

    fetchExtractedUrls()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>Loading extraction test...</h1>
        <p>Fetching and extracting URLs from Wikipedia...</p>
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

  // Separate by type
  const wikipediaUrls = urls.filter(c => c.url.includes('wikipedia.org'))
  const externalUrls = urls.filter(c => !c.url.includes('wikipedia.org'))
  
  // Group by section
  const bySection = urls.reduce((acc, cit) => {
    const section = cit.context || 'Unknown'
    if (!acc[section]) acc[section] = []
    acc[section].push(cit)
    return acc
  }, {} as Record<string, ExtractedUrl[]>)

  // Filter URLs based on search
  const filteredSections = Object.entries(bySection).reduce((acc, [section, sectionUrls]) => {
    const filtered = sectionUrls.filter(cit => {
      const searchLower = searchTerm.toLowerCase()
      return cit.url.toLowerCase().includes(searchLower) ||
             (cit.title || '').toLowerCase().includes(searchLower) ||
             (cit.context || '').toLowerCase().includes(searchLower)
    })
    if (filtered.length > 0) {
      acc[section] = filtered
    }
    return acc
  }, {} as Record<string, ExtractedUrl[]>)

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>📊 Wikipedia URL Extraction Test</h1>
        <p><strong>Source:</strong> <a href="https://en.wikipedia.org/wiki/Apartheid" target="_blank" rel="noopener noreferrer">Apartheid - Wikipedia</a></p>
        <p><strong>Extraction Date:</strong> {new Date().toISOString()}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', margin: '20px 0' }}>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #0066cc' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Total URLs</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0066cc' }}>{urls.length}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #0066cc' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Wikipedia URLs</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0066cc' }}>{wikipediaUrls.length}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #ffc107' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>External URLs</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffc107' }}>{externalUrls.length}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #28a745' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', textTransform: 'uppercase' }}>Sections</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>{Object.keys(bySection).length}</div>
        </div>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', background: 'white', borderRadius: '8px' }}>
        <input
          type="text"
          placeholder="Search URLs..."
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

      {Object.entries(filteredSections).map(([section, sectionUrls]) => (
        <div key={section} style={{ background: 'white', padding: '25px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 20px 0', borderBottom: '2px solid #0066cc', paddingBottom: '10px' }}>
            {section} <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>({sectionUrls.length} URLs)</span>
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sectionUrls.map((cit, idx) => {
              const isWikipedia = cit.url.includes('wikipedia.org')
              return (
                <li
                  key={idx}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${isWikipedia ? '#0066cc' : '#ffc107'}`,
                    transition: 'all 0.2s'
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
                      display: 'block',
                      marginBottom: '8px',
                      wordBreak: 'break-all'
                    }}
                  >
                    {cit.url}
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        marginLeft: '10px',
                        background: isWikipedia ? '#0066cc' : '#ffc107',
                        color: isWikipedia ? 'white' : '#333'
                      }}
                    >
                      {isWikipedia ? 'Wikipedia' : 'External'}
                    </span>
                  </a>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                    {cit.title && (
                      <span style={{ display: 'inline-block', marginRight: '15px', padding: '4px 8px', background: 'white', borderRadius: '4px' }}>
                        <strong>Title:</strong> {cit.title}
                      </span>
                    )}
                    {cit.context && cit.context !== cit.title && (
                      <span style={{ display: 'inline-block', marginRight: '15px', padding: '4px 8px', background: 'white', borderRadius: '4px' }}>
                        <strong>Context:</strong> {cit.context.substring(0, 150)}{cit.context.length > 150 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}


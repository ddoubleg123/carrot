'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface DiscoveryRun {
  id: string
  patchId: string
  startedAt: Date | string
  endedAt?: Date | string | null
  status: string
  metrics?: any
  patch?: {
    handle: string
    name?: string
  }
}

interface DiscoveryAudit {
  id: string
  runId: string
  patchId: string
  step: string
  status: string
  provider: string | null
  decisions?: any // JSON field from Prisma
  candidateUrl: string | null
  meta?: any
  error?: any
  ts: Date | string
  patch?: {
    handle: string
    name?: string
  }
}
}

export default function DiscoveryAuditPage() {
  const params = useParams()
  const handle = (params?.handle as string) || ''
  
  const [showAllPatches, setShowAllPatches] = useState(true) // Default to showing all
  const [isLive, setIsLive] = useState(false)
  const [selectedRun, setSelectedRun] = useState<DiscoveryRun | null>(null)
  const [runs, setRuns] = useState<DiscoveryRun[]>([])
  const [audits, setAudits] = useState<DiscoveryAudit[]>([])
  const [selectedAudit, setSelectedAudit] = useState<DiscoveryAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)

  // Load runs and audits
  useEffect(() => {
    loadData()
  }, [handle, showAllPatches])

  // Load audits when run is selected (but also show all if no run selected)
  useEffect(() => {
    if (selectedRun) {
      loadAudits(selectedRun.id)
    } else {
      loadAudits(null)
    }
  }, [selectedRun, showAllPatches])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const url = showAllPatches 
        ? `/api/patches/${handle}/discovery-audit/list?allPatches=true&limit=500`
        : `/api/patches/${handle}/discovery-audit/list?limit=500`
      
      const res = await fetch(url)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json()
      
      if (data.runs) {
        setRuns(data.runs)
        if (data.runs.length > 0 && !selectedRun) {
          setSelectedRun(data.runs[0])
        }
      }
      
      // Load all audits, not just from selected run
      if (data.audits) {
        setAudits(data.audits)
        setMetrics(data.run?.metrics || null)
      }
    } catch (err: any) {
      console.error('[Audit] Failed to load data:', err)
      setError(err.message || 'Failed to load discovery data')
    } finally {
      setLoading(false)
    }
  }

  const loadAudits = async (runId: string | null) => {
    try {
      const url = runId
        ? `/api/patches/${handle}/discovery-audit/list?runId=${runId}&allPatches=${showAllPatches}&limit=500`
        : `/api/patches/${handle}/discovery-audit/list?allPatches=${showAllPatches}&limit=500`
      
      const res = await fetch(url)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json()
      if (data.audits) {
        setAudits(data.audits)
        setMetrics(data.run?.metrics || null)
      }
    } catch (err: any) {
      console.error('[Audit] Failed to load audits:', err)
      setError(err.message || 'Failed to load audit data')
    }
  }

  const handleExport = () => {
    const ndjson = audits.map(a => JSON.stringify(a)).join('\n')
    const blob = new Blob([ndjson], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discovery-audit-${showAllPatches ? 'all' : handle}-${selectedRun?.id || 'all'}.ndjson`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!handle) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-red-600">Invalid patch handle</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading discovery data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Discovery Audit Trail
          </h1>
          <p className="text-gray-600">
            {showAllPatches ? (
              <>Showing discovery activity from <strong>ALL patches</strong></>
            ) : (
              <>Patch: <strong>{handle}</strong></>
            )}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
            <strong>Error:</strong> {error}
            <button 
              onClick={() => loadData()} 
              className="ml-4 text-red-800 underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Show All Patches Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllPatches}
                  onChange={(e) => {
                    setShowAllPatches(e.target.checked)
                    setSelectedRun(null)
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Show All Patches</span>
              </label>

              {/* Run Picker */}
              {!showAllPatches && (
                <select
                  value={selectedRun?.id || ''}
                  onChange={(e) => {
                    const run = runs.find(r => r.id === e.target.value)
                    setSelectedRun(run || null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {runs.length === 0 ? (
                    <option value="">No runs available</option>
                  ) : (
                    <>
                      <option value="">All runs</option>
                      {runs.map(run => (
                        <option key={run.id} value={run.id}>
                          {new Date(run.startedAt).toLocaleString()} - {run.status}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              )}

              {/* Live Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLive}
                  onChange={(e) => setIsLive(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Live</span>
              </label>
            </div>

            <button
              onClick={handleExport}
              disabled={audits.length === 0}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export NDJSON ({audits.length} records)
            </button>
          </div>

          {/* Metrics */}
          {metrics && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                Items Saved: {metrics.itemsSaved || 0}
              </div>
              <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                Total Processed: {metrics.totalProcessed || 0}
              </div>
              {metrics.durationMs && (
                <div className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                  Duration: {Math.round(metrics.durationMs / 1000)}s
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="mt-4 text-sm text-gray-600">
            <span>Runs: {runs.length} | </span>
            <span>Audit Records: {audits.length}</span>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {showAllPatches && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patch</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Decision</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={showAllPatches ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                      {error ? (
                        <>Error loading data. Check console for details.</>
                      ) : (
                        <>No audit records found. Start discovery to generate audit data.</>
                      )}
                    </td>
                  </tr>
                ) : (
                  audits.map((audit, idx) => {
                    const decisions = audit.decisions as any
                    const decisionAction = decisions?.action || 'pending'
                    const decisionReason = decisions?.reason || ''
                    
                    return (
                      <tr
                        key={audit.id}
                        onClick={() => setSelectedAudit(audit)}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selectedAudit?.id === audit.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        {showAllPatches && (
                          <td className="px-4 py-3 text-sm">
                            <span className="font-medium">{audit.patch?.handle || audit.patchId}</span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium">{audit.step}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            audit.status === 'ok' ? 'bg-green-100 text-green-800' :
                            audit.status === 'fail' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {audit.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{audit.provider || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {audit.candidateUrl ? (
                            <a
                              href={audit.candidateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-xs block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {audit.candidateUrl}
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            decisionAction === 'keep' ? 'bg-green-100 text-green-800' :
                            decisionAction === 'drop' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`} title={decisionReason}>
                            {decisionAction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(audit.ts).toLocaleTimeString()}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedAudit && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Audit Details</h2>
              <button
                onClick={() => setSelectedAudit(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                Ã—
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="font-medium">Step:</span> {selectedAudit.step}
              </div>
              <div>
                <span className="font-medium">Status:</span> {selectedAudit.status}
              </div>
              <div>
                <span className="font-medium">Provider:</span> {selectedAudit.provider || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Decision:</span> {JSON.stringify(selectedAudit.decisions || {})}
              </div>
              <div>
                <span className="font-medium">URL:</span>{' '}
                {selectedAudit.candidateUrl ? (
                  <a href={selectedAudit.candidateUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {selectedAudit.candidateUrl}
                  </a>
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </div>
              {selectedAudit.error && (
                <div>
                  <span className="font-medium">Error:</span>
                  <pre className="mt-2 p-3 bg-red-50 text-red-700 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedAudit.error, null, 2)}
                  </pre>
                </div>
              )}
              {selectedAudit.meta && (
                <div>
                  <span className="font-medium">Metadata:</span>
                  <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedAudit.meta, null, 2)}
                  </pre>
                </div>
              )}
              {selectedAudit.scores && (
                <div>
                  <span className="font-medium">Scores:</span>
                  <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedAudit.scores, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



/**
 * Admin dashboard for crawler
 * /admin/crawler
 * HTML page showing crawler metrics
 */

'use client'

import { useEffect, useState } from 'react'

interface CrawlerStats {
  summary: {
    totalPages: number
    fetched: number
    failed: number
    extracted: number
    extractionRate: number
  }
  distribution: {
    wiki: { count: number; percent: number }
    nonWiki: { count: number; percent: number }
    shortText: { count: number; percent: number }
  }
  topDomains: Array<{ domain: string; count: number }>
  topFailures: Array<{ reason: string; count: number }>
  sparkline: {
    extraction_ok: number[]
    labels: string[]
  }
  queues: {
    discovery: number
    extraction: number
  }
  last50: Array<{
    id: string
    url: string
    domain: string
    status: string
    httpStatus: number | null
    reasonCode: string | null
    textLen: number
    firstSeenAt: string
  }>
}

export default function CrawlerDashboard() {
  const [stats, setStats] = useState<CrawlerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/crawler')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        setStats(data)
        setError(null)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Crawler Dashboard</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Crawler Dashboard</h1>
        <p className="text-red-600">Error: {error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Crawler Dashboard</h1>
        <p>No data available</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Crawler Dashboard</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <div className="text-sm text-gray-600">Total Pages</div>
          <div className="text-2xl font-bold">{stats.summary.totalPages}</div>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <div className="text-sm text-gray-600">Fetched</div>
          <div className="text-2xl font-bold">{stats.summary.fetched}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <div className="text-sm text-gray-600">Extracted</div>
          <div className="text-2xl font-bold">{stats.summary.extracted}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded">
          <div className="text-sm text-gray-600">Extraction Rate</div>
          <div className="text-2xl font-bold">{stats.summary.extractionRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-sm text-gray-600">Wikipedia</div>
          <div className="text-xl font-bold">{stats.distribution.wiki.count}</div>
          <div className="text-sm text-gray-500">{stats.distribution.wiki.percent.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-sm text-gray-600">Non-Wikipedia</div>
          <div className="text-xl font-bold">{stats.distribution.nonWiki.count}</div>
          <div className="text-sm text-gray-500">{stats.distribution.nonWiki.percent.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-sm text-gray-600">Short Text</div>
          <div className="text-xl font-bold">{stats.distribution.shortText.count}</div>
          <div className="text-sm text-gray-500">{stats.distribution.shortText.percent.toFixed(1)}%</div>
        </div>
      </div>

      {/* Queues */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-indigo-50 p-4 rounded">
          <div className="text-sm text-gray-600">Discovery Queue</div>
          <div className="text-2xl font-bold">{stats.queues.discovery}</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded">
          <div className="text-sm text-gray-600">Extraction Queue</div>
          <div className="text-2xl font-bold">{stats.queues.extraction}</div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="bg-white p-4 rounded border mb-6">
        <h2 className="text-lg font-semibold mb-2">Extraction Rate (Last 24 Hours)</h2>
        <div className="flex items-end gap-1 h-32">
          {stats.sparkline.extraction_ok.map((value, i) => {
            const max = Math.max(...stats.sparkline.extraction_ok, 1)
            const height = (value / max) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${height}%` }}
                  title={`${stats.sparkline.labels[i]}: ${value}`}
                />
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left">
                  {stats.sparkline.labels[i]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Domains */}
      <div className="bg-white p-4 rounded border mb-6">
        <h2 className="text-lg font-semibold mb-2">Top Domains</h2>
        <ul className="space-y-1">
          {stats.topDomains.map(({ domain, count }) => (
            <li key={domain} className="flex justify-between">
              <span>{domain}</span>
              <span className="font-mono">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Top Failures */}
      <div className="bg-white p-4 rounded border mb-6">
        <h2 className="text-lg font-semibold mb-2">Top Failure Reasons</h2>
        <ul className="space-y-1">
          {stats.topFailures.map(({ reason, count }) => (
            <li key={reason} className="flex justify-between">
              <span className="text-red-600">{reason}</span>
              <span className="font-mono">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Last 50 Attempts */}
      <div className="bg-white p-4 rounded border">
        <h2 className="text-lg font-semibold mb-2">Last 50 Crawl Attempts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">URL</th>
                <th className="text-left p-2">Domain</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">HTTP</th>
                <th className="text-left p-2">Reason</th>
                <th className="text-left p-2">Text Len</th>
              </tr>
            </thead>
            <tbody>
              {stats.last50.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2 font-mono text-xs max-w-xs truncate">{item.url}</td>
                  <td className="p-2">{item.domain}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        item.status === 'fetched'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-2">{item.httpStatus || '-'}</td>
                  <td className="p-2 text-xs">{item.reasonCode || '-'}</td>
                  <td className="p-2 font-mono">{item.textLen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


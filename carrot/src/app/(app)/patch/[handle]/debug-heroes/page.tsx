'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Download, RefreshCw } from 'lucide-react'

interface HeroItem {
  id: string
  contentId: string
  sourceUrl: string
  title: string
  textLength: number
  renderUsed: boolean
  status: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  sourceTitle: string
}

export default function DebugHeroesPage() {
  const params = useParams()
  const handle = (params?.handle as string) || ''
  const [heroes, setHeroes] = useState<HeroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  if (!handle) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-red-600">Error: Patch handle not found</p>
          </div>
        </div>
      </div>
    )
  }

  const fetchHeroes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/patches/${handle}/debug-heroes`)
      if (!response.ok) {
        throw new Error(`Failed to fetch heroes: ${response.statusText}`)
      }
      const data = await response.json()
      setHeroes(data.heroes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHeroes()
  }, [handle])

  const exportCSV = () => {
    const headers = ['ID', 'Content ID', 'Source URL', 'Title', 'Text Length', 'Render Used', 'Status', 'Image URL', 'Created At', 'Updated At']
    const rows = heroes.map(h => [
      h.id,
      h.contentId,
      h.sourceUrl,
      h.title,
      h.textLength.toString(),
      h.renderUsed ? 'true' : 'false',
      h.status,
      h.imageUrl || '',
      h.createdAt,
      h.updatedAt
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `heroes-${handle}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Debug Heroes</h1>
              <p className="text-sm text-gray-500 mt-1">Patch: {handle}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchHeroes}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={exportCSV}
                disabled={heroes.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400 m-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading heroes...</div>
          ) : heroes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No heroes found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Text Length</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Render Used</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {heroes.map((hero) => (
                    <tr key={hero.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">{hero.id.substring(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">{hero.contentId.substring(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        <a href={hero.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {hero.sourceUrl}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={hero.title}>
                        {hero.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{hero.textLength}</td>
                      <td className="px-4 py-3 text-sm">
                        {hero.renderUsed ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Yes</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          hero.status === 'READY' ? 'bg-green-100 text-green-800' :
                          hero.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                          hero.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {hero.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {hero.imageUrl ? (
                          <a href={hero.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {hero.imageUrl.substring(0, 40)}...
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(hero.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(hero.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && heroes.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-sm text-gray-500">
              Showing {heroes.length} heroes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


/**
 * Discovery Audit Test Page
 * Live and historical audit trail viewer
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import RunPicker from '@/components/audit/RunPicker'
import FiltersBar from '@/components/audit/FiltersBar'
import AuditTable from '@/components/audit/AuditTable'
import AuditDetailDrawer from '@/components/audit/AuditDetailDrawer'
import type { DiscoveryRun, DiscoveryAudit } from '@prisma/client'

export default function DiscoveryAuditPage() {
  const params = useParams()
  const handle = params.handle as string
  
  const [isLive, setIsLive] = useState(false)
  const [selectedRun, setSelectedRun] = useState<DiscoveryRun | null>(null)
  const [runs, setRuns] = useState<DiscoveryRun[]>([])
  const [audits, setAudits] = useState<DiscoveryAudit[]>([])
  const [selectedAudit, setSelectedAudit] = useState<DiscoveryAudit | null>(null)
  const [filters, setFilters] = useState({
    step: [] as string[],
    status: [] as string[],
    provider: '',
    decision: '',
    search: ''
  })
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const res = await fetch(`/api/patches/${handle}/discovery-audit/list?limit=10`)
        const data = await res.json()
        if (data.runs) {
          setRuns(data.runs)
          if (data.runs.length > 0 && !selectedRun) {
            setSelectedRun(data.runs[0])
          }
        }
      } catch (error) {
        console.error('[Audit] Failed to load runs:', error)
      } finally {
        setLoading(false)
      }
    }
    loadRuns()
  }, [handle])

  useEffect(() => {
    if (selectedRun) {
      const loadAudits = async () => {
        try {
          const params = new URLSearchParams({
            runId: selectedRun.id,
            limit: '200'
          })
          const res = await fetch(`/api/patches/${handle}/discovery-audit/list?${params}`)
          const data = await res.json()
          if (data.audits) {
            setAudits(data.audits)
            setMetrics(data.run?.metrics || null)
          }
        } catch (error) {
          console.error('[Audit] Failed to load audits:', error)
        }
      }
      loadAudits()
    }
  }, [selectedRun, handle])

  useEffect(() => {
    if (isLive && selectedRun) {
      const es = new EventSource(`/api/patches/${handle}/discovery-audit/stream?runId=${selectedRun.id}`)
      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'audit') {
          setAudits(prev => [...prev, data.data])
        }
      }
      es.onerror = () => es.close()
      setEventSource(es)
      return () => es.close()
    } else if (eventSource) {
      eventSource.close()
      setEventSource(null)
    }
  }, [isLive, selectedRun, handle])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discovery Audit Trail</h1>
          <p className="text-gray-600">Live and historical view of discovery pipeline decisions</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="flex items-center gap-4">
            <RunPicker runs={runs} selectedRun={selectedRun} onSelect={setSelectedRun} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Live</span>
            </label>
          </div>
        </div>
        <FiltersBar filters={filters} onFiltersChange={setFilters} />
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <AuditTable audits={audits} onSelectAudit={setSelectedAudit} isLive={isLive} />
          </div>
          <div className="sticky top-6 h-fit">
            <AuditDetailDrawer audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
          </div>
        </div>
      </div>
    </div>
  )
}
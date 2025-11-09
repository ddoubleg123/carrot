/**
 * Live Panel Component
 * Shows real-time discovery progress on the left side
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, Square, Pause, RefreshCw, AlertTriangle, Clock } from 'lucide-react'

type DiscoveryStage = 'searching' | 'vetting' | 'hero' | 'saved' | undefined

interface LivePanelProps {
  isActive: boolean
  isPaused: boolean
  stage?: DiscoveryStage
  currentStatus: string
  itemsFound: number
  lastItemTitle?: string
  error?: string
  runId?: string
  onStart: () => void | Promise<void>
  onPause: () => void | Promise<void>
  onStop: () => void | Promise<void>
  onRefresh: () => void | Promise<void>
  className?: string
}

const stageOrder: DiscoveryStage[] = ['searching', 'vetting', 'hero', 'saved']

function stageLabel(stage: DiscoveryStage) {
  switch (stage) {
    case 'searching':
      return 'Searching'
    case 'vetting':
      return 'Vetting'
    case 'hero':
      return 'Generating Hero'
    case 'saved':
      return 'Saved'
    default:
      return 'Idle'
  }
}

export default function LivePanel({
  isActive,
  isPaused,
  stage,
  currentStatus,
  itemsFound,
  lastItemTitle,
  error,
  runId,
  onStart,
  onPause,
  onStop,
  onRefresh,
  className = ''
}: LivePanelProps) {
  const getStatusIcon = () => {
    if (error) return <AlertTriangle className="h-4 w-4 text-red-500" />
    if (isActive && !isPaused) return <Play className="h-4 w-4 text-green-500" />
    if (isPaused) return <Pause className="h-4 w-4 text-yellow-500" />
    return <Clock className="h-4 w-4 text-gray-500" />
  }

  const getStatusColor = () => {
    if (error) return 'bg-red-50 border-red-200 text-red-700'
    if (isActive && !isPaused) return 'bg-green-50 border-green-200 text-green-700'
    if (isPaused) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    return 'bg-gray-50 border-gray-200 text-gray-700'
  }

  const currentStageIndex = stage ? stageOrder.indexOf(stage) : -1

  const handlePrimaryAction = () => {
    if (!isActive) {
      void onStart()
      return
    }
    if (isPaused) {
      void onPause()
      return
    }
    void onPause()
  }

  const handleStopAction = () => {
    void onStop()
  }

  const handleRefreshAction = () => {
    void onRefresh()
  }

  return (
    <aside className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className={`rounded-xl border p-4 ${getStatusColor()}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm font-semibold">
              {error ? 'Error' : isActive ? (isPaused ? 'Paused' : 'Live Discovery') : 'Idle'}
            </span>
          </div>
          {runId && (
            <Badge variant="secondary" className="text-[10px] tracking-wide uppercase">
              Run {runId.slice(0, 6)}
            </Badge>
          )}
        </div>

        {currentStatus && (
          <p className="mt-2 text-xs text-gray-700">{currentStatus}</p>
        )}

        {error && (
          <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {itemsFound} saved
          </Badge>
          {lastItemTitle && (
            <span className="max-w-[200px] truncate text-xs text-gray-500">
              Latest: {lastItemTitle}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handlePrimaryAction}
          className="w-full bg-blue-600 text-white hover:bg-blue-700"
          size="sm"
        >
          {isActive ? (
            isPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume Discovery
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause Discovery
              </>
            )
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Discovery
            </>
          )}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleStopAction}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!isActive}
          >
            <Square className="mr-2 h-4 w-4" />
            Stop
          </Button>
          <Button
            onClick={handleRefreshAction}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
        <ol className="mt-3 space-y-3">
          {stageOrder.map((step, index) => {
            const isComplete = currentStageIndex > index
            const isCurrent = currentStageIndex === index
            return (
              <li key={step} className="flex items-start gap-3">
                <div
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    isComplete
                      ? 'bg-green-500'
                      : isCurrent
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-slate-200'
                  }`}
                />
                <div>
                  <p className={`text-sm font-medium ${isComplete ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                    {stageLabel(step)}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-slate-500">
                      {currentStatus || 'In progress'}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </aside>
  )
}

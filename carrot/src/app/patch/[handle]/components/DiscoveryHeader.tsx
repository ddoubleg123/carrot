'use client'

import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCw } from 'lucide-react'
import { DiscoveryPhase } from '../hooks/useDiscoveryStream'

interface DiscoveryHeaderProps {
  state: DiscoveryPhase
  done: number
  total: number
  live: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onRefresh: () => void
}

const HELPER_TEXT: Record<DiscoveryPhase, string> = {
  idle: 'Ready to discover content',
  searching: 'Searching for content…',
  processing: 'Streaming items as they are ready',
  paused: 'Paused — resume when ready',
  completed: 'Discovery complete',
  error: 'An error occurred'
}

export default function DiscoveryHeader({
  state,
  done,
  total,
  live,
  onStart,
  onPause,
  onResume,
  onRestart,
  onRefresh
}: DiscoveryHeaderProps) {
  
  const getPrimaryButton = () => {
    switch (state) {
      case 'idle':
        return (
          <Button
            onClick={onStart}
            variant="default"
            className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Discovery
          </Button>
        )
      
      case 'searching':
      case 'processing':
        return (
          <Button
            onClick={onPause}
            variant="outline"
            className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Discovery
          </Button>
        )
      
      case 'paused':
        return (
          <Button
            onClick={onResume}
            variant="default"
            className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <Play className="w-4 h-4 mr-2" />
            Resume Discovery
          </Button>
        )
      
      case 'completed':
      case 'error':
        return (
          <Button
            onClick={onRestart}
            variant="default"
            className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Restart
          </Button>
        )
    }
  }

  const showRefresh = state !== 'searching' && state !== 'processing'

  return (
    <div className="mt-6 mb-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        {/* Left: Title + Live Indicator + Progress */}
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-[#0B0B0F]">
            Discovering content
          </h2>
          
          {live && (
            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-green-50 text-green-700 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
          
          {live && total > 0 && (
            <span className="text-xs text-slate-600">
              {done}/{total}
            </span>
          )}
        </div>
        
        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {showRefresh && (
            <Button
              onClick={onRefresh}
              variant="outline"
              size="sm"
              className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          )}
          
          {getPrimaryButton()}
        </div>
      </div>
      
      {/* Helper Text */}
      <div className="mt-1 mb-3 text-sm text-slate-600">
        {HELPER_TEXT[state]}
      </div>
    </div>
  )
}


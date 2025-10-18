'use client'

import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCw } from 'lucide-react'
import { DiscoveryPhase } from '../hooks/useDiscoveryStreamSingle'

interface DiscoveryHeaderSingleProps {
  state: DiscoveryPhase
  live: boolean
  statusText: string
  lastItemTitle: string | null
  sessionCount: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRefresh: () => void
}

export default function DiscoveryHeaderSingle({
  state,
  live,
  statusText,
  lastItemTitle,
  sessionCount,
  onStart,
  onPause,
  onResume,
  onRefresh
}: DiscoveryHeaderSingleProps) {
  
  const getPrimaryButton = () => {
    if (state === 'idle' || state === 'error') {
      return (
        <Button
          onClick={onStart}
          variant="primary"
          className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
        >
          <Play className="w-4 h-4 mr-2" />
          Start discovery
        </Button>
      )
    }
    
    if (state === 'paused') {
      return (
        <Button
          onClick={onResume}
          variant="primary"
          className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
        >
          <Play className="w-4 h-4 mr-2" />
          Resume discovery
        </Button>
      )
    }
    
    // searching or processing
    return (
      <Button
        onClick={onPause}
        variant="outline"
        className="focus-visible:ring-2 focus-visible:ring-[#0A5AFF]"
      >
        <Pause className="w-4 h-4 mr-2" />
        Pause discovery
      </Button>
    )
  }

  return (
    <div className="mt-4 mb-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        {/* Left: Title + Live Badge */}
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-[#0B0B0F]">
            Discovering content
          </h2>
          
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-green-50 text-green-700 px-2.5 py-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        
        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {!live && (
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
      
      {/* Status Line */}
      <div className="mt-2 mb-3 flex items-center justify-between text-sm">
        <span className="text-slate-600">{statusText}</span>
        
        {live && (
          <span className="text-xs text-slate-500">
            1 item/cycle • {sessionCount} added this session
          </span>
        )}
      </div>
      
      {/* Last Item (when live and we have one) */}
      {live && lastItemTitle && (
        <div className="mb-3 text-xs text-slate-500">
          Last item: {lastItemTitle.substring(0, 60)}{lastItemTitle.length > 60 ? '...' : ''}
        </div>
      )}
    </div>
  )
}


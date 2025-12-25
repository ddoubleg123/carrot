'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'
import { useDiscoveryRunner } from '../hooks/useDiscoveryRunner'

interface DiscoveryHeaderProps {
  patchHandle: string
  onRefresh?: () => void
}

export default function DiscoveryHeader({ patchHandle, onRefresh }: DiscoveryHeaderProps) {
  const {
    state,
    count,
    totalProcessed,
    error,
    start,
    pause,
    resume,
    restart,
    refresh
  } = useDiscoveryRunner(patchHandle, {
    batchSize: 10,
    autoLoop: true,
    delayBetweenBatches: 2000
  })

  const handleRefresh = () => {
    refresh()
    onRefresh?.()
  }

  const getPrimaryButtonConfig = () => {
    switch (state) {
      case 'idle':
        return {
          label: 'Start Discovery',
          variant: 'primary' as const,
          onClick: start
        }
      case 'running':
        return {
          label: 'Pause Discovery',
          variant: 'outline' as const,
          onClick: pause
        }
      case 'paused':
        return {
          label: 'Resume Discovery',
          variant: 'primary' as const,
          onClick: resume
        }
      case 'completed':
        return {
          label: 'Restart Discovery',
          variant: 'primary' as const,
          onClick: restart
        }
      default:
        return {
          label: 'Start Discovery',
          variant: 'primary' as const,
          onClick: start
        }
    }
  }

  const primaryButton = getPrimaryButtonConfig()

  return (
    <div className="mt-6 mb-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        {/* Left Side */}
        <div className="flex items-center">
          <h2 className="text-xl font-semibold text-slate-900">Discovering content</h2>
          
          {/* LIVE Pill */}
          {state === 'running' && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs rounded-full bg-green-50 text-green-700 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
          
          {/* Progress Counter */}
          {state === 'running' && (
            <span className="ml-2 text-xs text-slate-600 font-medium">
              {count}/10
            </span>
          )}
          
          {/* Completed Indicator */}
          {state === 'completed' && (
            <span className="ml-2 text-xs text-green-600 font-medium">
              ✓ Batch complete
            </span>
          )}
        </div>

        {/* Right Side - Buttons */}
        <div className="flex items-center gap-2">
          {/* Primary Action Button */}
          <Button
            variant={primaryButton.variant}
            size="sm"
            onClick={primaryButton.onClick}
            className="h-8 bg-[#FF6A00] hover:bg-[#E55A00] text-white"
          >
            {primaryButton.label}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">Error starting discovery:</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Helper Text */}
      <p className="mt-1 mb-3 text-sm text-slate-600">
        {state === 'running' 
          ? "We're actively finding posts, videos, and resources that match this group. New items will appear here."
          : state === 'paused'
          ? "Discovery is paused. Click 'Resume Discovery' to continue finding content."
          : state === 'completed'
          ? "Discovery batch completed. Click 'Restart Discovery' to find more content."
          : "Click 'Start Discovery' to begin finding relevant content for this group."
        }
      </p>

      {/* Progress Bar (when running) */}
      {state === 'running' && (
        <div className="mb-3">
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div 
              className="bg-[#FF6A00] h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(count / 10) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

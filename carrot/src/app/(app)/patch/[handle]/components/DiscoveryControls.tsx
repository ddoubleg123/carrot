'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Square, RefreshCw, Activity, Clock, CheckCircle, XCircle } from 'lucide-react'

interface DiscoveryControlsProps {
  patchHandle: string
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onRefresh: () => void
  isActive: boolean
  isPaused: boolean
  currentStatus?: string
  itemsFound?: number
  lastItemTitle?: string
}

export default function DiscoveryControls({
  patchHandle,
  onStart,
  onPause,
  onStop,
  onRefresh,
  isActive,
  isPaused,
  currentStatus,
  itemsFound = 0,
  lastItemTitle
}: DiscoveryControlsProps) {
  const [statusHistory, setStatusHistory] = useState<string[]>([])
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [duration, setDuration] = useState(0)

  // Update duration every second when active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (isActive && startTime) {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, startTime])

  // Track status changes
  useEffect(() => {
    if (currentStatus) {
      setStatusHistory(prev => {
        const newHistory = [...prev, currentStatus]
        return newHistory.slice(-5) // Keep last 5 status updates
      })
    }
  }, [currentStatus])

  // Handle start
  const handleStart = () => {
    setStartTime(new Date())
    setDuration(0)
    setStatusHistory([])
    onStart()
  }

  // Handle stop
  const handleStop = () => {
    setStartTime(null)
    setDuration(0)
    setStatusHistory([])
    onStop()
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <div className="flex items-center gap-3">
        {!isActive ? (
          <Button
            onClick={handleStart}
            className="flex items-center gap-2"
            size="sm"
          >
            <Play className="h-4 w-4" />
            Start Discovery
          </Button>
        ) : isPaused ? (
          <Button
            onClick={onPause}
            className="flex items-center gap-2"
            size="sm"
          >
            <Play className="h-4 w-4" />
            Resume
          </Button>
        ) : (
          <Button
            onClick={onPause}
            variant="outline"
            className="flex items-center gap-2"
            size="sm"
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}
        
        {isActive && (
          <Button
            onClick={handleStop}
            variant="outline"
            className="flex items-center gap-2"
            size="sm"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        )}
        
        <Button
          onClick={onRefresh}
          variant="outline"
          className="flex items-center gap-2"
          size="sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Status Display */}
      {isActive && (
        <div className="space-y-3">
          {/* Live Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500 animate-pulse" />
              <span className="text-sm font-medium">Live Discovery</span>
            </div>
            
            {duration > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="h-3 w-3" />
                {formatDuration(duration)}
              </div>
            )}
            
            {itemsFound > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {itemsFound} found
              </Badge>
            )}
          </div>

          {/* Current Status */}
          {currentStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-blue-900">
                  {currentStatus}
                </span>
              </div>
            </div>
          )}

          {/* Last Item */}
          {lastItemTitle && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Latest: {lastItemTitle}
                </span>
              </div>
            </div>
          )}

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Recent Activity
              </h4>
              <div className="space-y-1">
                {statusHistory.slice(-3).map((status, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="h-1 w-1 bg-gray-400 rounded-full" />
                    {status}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discovery Stats */}
      {isActive && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">Items Found</div>
            <div className="text-2xl font-bold text-green-600">{itemsFound}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">Duration</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatDuration(duration)}
            </div>
          </div>
        </div>
      )}

      {/* Auto-restart Notice */}
      {isActive && itemsFound >= 10 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Auto-restarting after 10 items to continue discovery
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

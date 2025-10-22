/**
 * Live Panel Component
 * Shows real-time discovery progress on the left side
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, Square, Pause, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface LivePanelProps {
  isActive: boolean
  isPaused: boolean
  currentStatus: string
  itemsFound: number
  lastItemTitle?: string
  error?: string
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onRefresh: () => void
}

export default function LivePanel({
  isActive,
  isPaused,
  currentStatus,
  itemsFound,
  lastItemTitle,
  error,
  onStart,
  onPause,
  onStop,
  onRefresh
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

  return (
    <div className="sticky top-4 space-y-4">
      {/* Status Card */}
      <div className={`rounded-lg border p-4 ${getStatusColor()}`}>
        <div className="flex items-center gap-2 mb-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {error ? 'Error' : isActive ? (isPaused ? 'Paused' : 'Live') : 'Idle'}
          </span>
        </div>
        
        {currentStatus && (
          <p className="text-xs text-gray-600 mb-2">{currentStatus}</p>
        )}
        
        {error && (
          <p className="text-xs text-red-600 mb-2">{error}</p>
        )}
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {itemsFound} items
          </Badge>
          {lastItemTitle && (
            <span className="text-xs text-gray-500 truncate">
              Latest: {lastItemTitle}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        {!isActive ? (
          <Button
            onClick={onStart}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Discovery
          </Button>
        ) : (
          <div className="flex gap-2">
            {isPaused ? (
              <Button
                onClick={onStart}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            ) : (
              <Button
                onClick={onPause}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                size="sm"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}
            <Button
              onClick={onStop}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </div>
        )}
        
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Recent Activity</h3>
        <div className="space-y-2 text-xs text-gray-600">
          {isActive ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Searching Wikipedia...</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span>Processing citations...</span>
              </div>
              {itemsFound > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Found {itemsFound} relevant items</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-400">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

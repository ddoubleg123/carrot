/**
 * Discovery Header Component
 * 
 * Shows live status, progress, and controls for discovery process
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCw, RefreshCw } from 'lucide-react';
import { DiscoveryState } from '../hooks/useDiscoveryStream';

interface DiscoveryHeaderProps {
  state: DiscoveryState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onRefresh: () => void;
  isConnected: boolean;
}

export function DiscoveryHeader({
  state,
  onStart,
  onPause,
  onResume,
  onRestart,
  onRefresh,
  isConnected
}: DiscoveryHeaderProps) {
  const getHelperText = () => {
    switch (state.phase) {
      case 'searching':
        return 'Searching for content…';
      case 'processing':
        return 'Streaming items as they\'re ready';
      case 'paused':
        return 'Paused — resume when ready';
      case 'completed':
        return 'Discovery complete';
      case 'error':
        return state.error || 'An error occurred';
      default:
        return 'Ready to discover content';
    }
  };
  
  const getPrimaryButton = () => {
    switch (state.phase) {
      case 'idle':
        return (
          <Button onClick={onStart} variant="default">
            <Play className="h-4 w-4 mr-2" />
            Start Discovery
          </Button>
        );
      case 'searching':
      case 'processing':
        return (
          <Button onClick={onPause} variant="outline">
            <Pause className="h-4 w-4 mr-2" />
            Pause Discovery
          </Button>
        );
      case 'paused':
        return (
          <Button onClick={onResume} variant="default">
            <Play className="h-4 w-4 mr-2" />
            Resume Discovery
          </Button>
        );
      case 'completed':
        return (
          <Button onClick={onRestart} variant="default">
            <RotateCw className="h-4 w-4 mr-2" />
            Restart
          </Button>
        );
      case 'error':
        return (
          <Button onClick={onRestart} variant="default">
            <RotateCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="mt-6 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Discovering content</h2>
          
          {state.live && (
            <span className="inline-flex items-center gap-1 text-xs rounded-full bg-green-50 text-green-700 px-2 py-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
          )}
          
          {state.live && (
            <span className="ml-2 text-xs text-slate-600">
              {state.done}/{state.total || 10}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {getPrimaryButton()}
          
          {state.phase !== 'processing' && (
            <Button onClick={onRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>
      
      {/* Helper text */}
      <div className="mt-1 mb-3 text-sm text-slate-600">
        {getHelperText()}
      </div>
      
      {/* Progress bar */}
      {state.live && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(state.done / state.total) * 100}%` }}
          />
        </div>
      )}
      
      {/* Connection status */}
      {!isConnected && state.phase !== 'idle' && (
        <div className="mt-2 text-xs text-amber-600">
          Reconnecting...
        </div>
      )}
    </div>
  );
}
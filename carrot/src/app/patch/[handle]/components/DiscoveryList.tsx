/**
 * Discovery List Component
 * 
 * Renders discovered items with real-time updates
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DiscoveryHeader } from './DiscoveryHeader';
import { DiscoveryCard } from './DiscoveryCard';
import { DiscoveredItem } from '@/types/discovered-content';
import { DiscoveryState } from '../hooks/useDiscoveryStream';

interface DiscoveryListProps {
  patchHandle: string;
  state: DiscoveryState;
  items: DiscoveredItem[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onRefresh: () => void;
  isConnected: boolean;
}

export function DiscoveryList({
  patchHandle,
  state,
  items,
  onStart,
  onPause,
  onResume,
  onRestart,
  onRefresh,
  isConnected
}: DiscoveryListProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <DiscoveryHeader
        state={state}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onRestart={onRestart}
        onRefresh={onRefresh}
        isConnected={isConnected}
      />
      
      {/* Filters */}
      <div className="mt-2 mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-600">Filter by type:</span>
        <select className="text-sm border rounded px-2 py-1">
          <option value="all">All</option>
          <option value="article">Articles</option>
          <option value="video">Videos</option>
          <option value="pdf">PDFs</option>
        </select>
      </div>
      
      {/* Items */}
      <div className="space-y-4">
        {items.length === 0 && state.phase === 'idle' && (
          <Card>
            <CardContent className="p-6 text-center text-slate-500">
              No content discovered yet. Click "Start Discovery" to begin.
            </CardContent>
          </Card>
        )}
        
        {items.length === 0 && state.phase === 'searching' && (
          <div className="space-y-4">
            {/* Skeleton cards while searching */}
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {items.map(item => (
          <DiscoveryCard
            key={item.id}
            item={item}
            patchHandle={patchHandle}
          />
        ))}
      </div>
      
      {/* Status message */}
      {state.phase === 'completed' && items.length > 0 && (
        <div className="text-center py-4 text-slate-600">
          Discovery complete! Found {items.length} items.
        </div>
      )}
      
      {state.phase === 'error' && (
        <div className="text-center py-4 text-red-600">
          {state.error || 'An error occurred during discovery.'}
        </div>
      )}
    </div>
  );
}
/**
 * Single Discovery List Component
 * 
 * Integrates the new discovery system with real-time updates
 */

import React from 'react';
import { useDiscoveryStream } from '../hooks/useDiscoveryStream';
import { DiscoveryList } from './DiscoveryList';

interface DiscoveryListSingleProps {
  patchHandle: string;
}

export function DiscoveryListSingle({ patchHandle }: DiscoveryListSingleProps) {
  const {
    state,
    items,
    start,
    pause,
    resume,
    restart,
    refresh,
    isConnected,
    isRunning,
    hasError
  } = useDiscoveryStream({
    patchHandle,
    batchSize: 10,
    autoStart: false
  });
  
  return (
    <DiscoveryList
      patchHandle={patchHandle}
      state={state}
      items={items}
      onStart={start}
      onPause={pause}
      onResume={resume}
      onRestart={restart}
      onRefresh={refresh}
      isConnected={isConnected}
    />
  );
}
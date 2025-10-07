'use client';

import { useEffect } from 'react';
import { ChunkErrorHandler } from '@/lib/chunkErrorHandler';
import { setupGlobalNetworkErrorHandler } from '@/lib/networkErrorHandler';

/**
 * Global error handlers component that initializes all error handling systems
 * This runs on the client side to ensure proper error handling
 */
export default function GlobalErrorHandlers() {
  useEffect(() => {
    // Initialize chunk error handler
    ChunkErrorHandler.getInstance();
    
    // Initialize network error handler
    setupGlobalNetworkErrorHandler();
    
    console.log('[GlobalErrorHandlers] All error handlers initialized');
  }, []);

  // This component doesn't render anything
  return null;
}

'use client';

import { useNetworkErrorHandler } from '@/hooks/useNetworkErrorHandler';
import { useEffect, useState } from 'react';

export default function NetworkStatusIndicator() {
  const { errors, isOnline, hasRecentErrors, hasRetryableErrors, clearErrors } = useNetworkErrorHandler();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (hasRecentErrors || !isOnline) {
      setIsVisible(true);
    } else {
      // Hide after a delay when errors are cleared
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasRecentErrors, isOnline]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className={`
        p-3 rounded-lg shadow-lg border backdrop-blur-sm
        ${!isOnline 
          ? 'bg-red-100 border-red-300 text-red-800' 
          : hasRetryableErrors 
            ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
            : 'bg-green-100 border-green-300 text-green-800'
        }
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`
              w-2 h-2 rounded-full
              ${!isOnline 
                ? 'bg-red-500' 
                : hasRetryableErrors 
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }
            `} />
            <span className="text-sm font-medium">
              {!isOnline 
                ? 'Offline' 
                : hasRetryableErrors 
                  ? 'Network Issues'
                  : 'Connected'
              }
            </span>
          </div>
          {hasRecentErrors && (
            <button
              onClick={clearErrors}
              className="text-xs underline hover:no-underline"
            >
              Dismiss
            </button>
          )}
        </div>
        
        {!isOnline && (
          <p className="text-xs mt-1">
            Check your internet connection
          </p>
        )}
        
        {isOnline && hasRetryableErrors && (
          <p className="text-xs mt-1">
            Some requests failed. Retrying automatically...
          </p>
        )}
        
        {errors.length > 0 && (
          <div className="mt-2 text-xs opacity-75">
            {errors.length} recent error{errors.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

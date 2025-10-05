import { useEffect, useState } from 'react';

export interface NetworkError {
  message: string;
  timestamp: number;
  retryable: boolean;
  errorType?: string;
}

export function useNetworkErrorHandler() {
  const [errors, setErrors] = useState<NetworkError[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      setErrors([]); // Clear errors when back online
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addError = (error: NetworkError) => {
    setErrors(prev => [...prev.slice(-4), error]); // Keep only last 5 errors
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const hasRecentErrors = errors.length > 0;
  const hasRetryableErrors = errors.some(e => e.retryable);

  return {
    errors,
    isOnline,
    hasRecentErrors,
    hasRetryableErrors,
    addError,
    clearErrors
  };
}

/**
 * Hook to handle fetch errors and provide retry functionality
 */
export function useFetchWithErrorHandling() {
  const { addError, clearErrors } = useNetworkErrorHandler();

  const fetchWithErrorHandling = async (
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    try {
      const response = await fetch(url, options);
      
      // Clear errors on successful request
      if (response.ok) {
        clearErrors();
      }
      
      return response;
    } catch (error) {
      const errorObj = error as Error;
      const isNetworkError = errorObj.message.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
                            errorObj.message.includes('ERR_QUIC_PROTOCOL_ERROR') ||
                            errorObj.message.includes('Failed to fetch') ||
                            errorObj.message.includes('NetworkError');

      if (isNetworkError) {
        addError({
          message: 'Network connection issue detected',
          timestamp: Date.now(),
          retryable: true,
          errorType: 'network_protocol_error'
        });
      }

      throw error;
    }
  };

  return { fetchWithErrorHandling };
}

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  postId?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class VideoErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error, 
      errorInfo: null, // errorInfo is set in componentDidCatch
      retryCount: 0,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[VideoErrorBoundary] Video component error:', error, errorInfo);
    this.setState({ errorInfo });

    // Check if this is a video-specific error that can be retried
    const isRetryableError = 
      error.message.includes('play()') ||
      error.message.includes('load()') ||
      error.message.includes('video') ||
      error.message.includes('network') ||
      error.message.includes('fetch');

    if (isRetryableError && this.state.retryCount < this.maxRetries) {
      console.log(`[VideoErrorBoundary] Auto-retrying video error (attempt ${this.state.retryCount + 1}/${this.maxRetries})`);
      
      // Exponential backoff: 1s, 3s, 5s
      const delay = 1000 * (1 + (this.state.retryCount * 2));
      
      this.retryTimeout = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prevState.retryCount + 1,
        }));
      }, delay);
    }
  }

  public componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleManualRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center bg-gray-100 rounded-xl p-8 min-h-[200px]">
          <div className="text-center">
            <div className="text-gray-400 mb-2">📹</div>
            <div className="text-sm text-gray-500 mb-2">Video temporarily unavailable</div>
            <div className="text-xs text-gray-400 mb-4">
              {this.state.retryCount >= this.maxRetries 
                ? 'Max retries reached' 
                : `Retrying automatically (${this.state.retryCount + 1}/${this.maxRetries})`}
            </div>
            {this.state.retryCount < this.maxRetries && (
              <button
                onClick={this.handleManualRetry}
                className="px-4 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Retry Now
              </button>
            )}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600 w-full max-w-md">
                <summary>Error Details (Development)</summary>
                <pre className="whitespace-pre-wrap break-all text-xs">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VideoErrorBoundary;

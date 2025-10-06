'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

class ChunkErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a chunk loading error
    if (error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError')) {
      return { hasError: true, error, retryCount: 0 };
    }
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ChunkErrorBoundary caught an error:', error, errorInfo);
    
    // If it's a chunk loading error, try to retry
    if (error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError')) {
      this.handleChunkError(error);
    }
  }

  private handleChunkError = (error: Error) => {
    if (this.state.retryCount < this.maxRetries) {
      console.log(`Retrying chunk load (attempt ${this.state.retryCount + 1}/${this.maxRetries})`);
      
      setTimeout(() => {
        // Force a page reload to retry chunk loading
        window.location.reload();
      }, this.retryDelay * (this.state.retryCount + 1));
      
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1
      }));
    } else {
      console.error('Max retries reached for chunk loading');
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, retryCount: 0 });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.state.error?.message.includes('Loading chunk') || this.state.error?.message.includes('ChunkLoadError')) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Loading Error</h2>
              <p className="text-gray-600 mb-4">
                There was an issue loading the application. {this.state.retryCount < this.maxRetries ? 'Retrying...' : 'Please refresh the page.'}
              </p>
              {this.state.retryCount >= this.maxRetries && (
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        );
      }

      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;

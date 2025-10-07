// Connection pool manager for HTTP/1.1 optimization
export class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: Map<string, AbortController[]> = new Map();
  private maxConnectionsPerHost = 6; // HTTP/1.1 default
  private connectionTimeout = 45000; // 45 seconds - increased for stability
  private connectionRetryDelay = 1000; // 1 second between connection attempts
  private maxRetries = 3; // Maximum retries for connection failures

  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  private getHostKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return url;
    }
  }

  private cleanupConnections(hostKey: string) {
    const connections = this.connections.get(hostKey) || [];
    const activeConnections = connections.filter(controller => !controller.signal.aborted);
    this.connections.set(hostKey, activeConnections);
  }

  createConnection(url: string): AbortController {
    const hostKey = this.getHostKey(url);
    this.cleanupConnections(hostKey);
    
    const connections = this.connections.get(hostKey) || [];
    
    // If we're at the connection limit, abort the oldest connection
    if (connections.length >= this.maxConnectionsPerHost) {
      const oldestConnection = connections.shift();
      if (oldestConnection) {
        oldestConnection.abort();
      }
    }

    const controller = new AbortController();
    connections.push(controller);
    this.connections.set(hostKey, connections);

    // Set up automatic cleanup with connection health monitoring
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        console.warn(`[ConnectionPool] Connection timeout for ${hostKey}, aborting...`);
        controller.abort();
      }
    }, this.connectionTimeout);

    // Add connection health monitoring
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      this.cleanupConnections(hostKey);
    });

    return controller;
  }

  abortAllConnections(hostKey?: string) {
    if (hostKey) {
      const connections = this.connections.get(hostKey) || [];
      connections.forEach(controller => controller.abort());
      this.connections.delete(hostKey);
    } else {
      // Abort all connections
      this.connections.forEach(connections => {
        connections.forEach(controller => controller.abort());
      });
      this.connections.clear();
    }
  }

  getConnectionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.connections.forEach((connections, hostKey) => {
      stats[hostKey] = connections.filter(c => !c.signal.aborted).length;
    });
    return stats;
  }

  getPoolStatus(): Record<string, number> {
    return this.getConnectionStats();
  }

  /**
   * Handle connection failure and retry logic
   */
  async handleConnectionFailure(url: string, error: Error): Promise<boolean> {
    const hostKey = this.getHostKey(url);
    const isConnectionError = error.message.includes('connection closed') || 
                             error.message.includes('connection reset') ||
                             error.message.includes('ERR_CONNECTION_CLOSED');
    
    if (isConnectionError) {
      console.warn(`[ConnectionPool] Connection failure detected for ${hostKey}:`, error.message);
      
      // Abort all connections for this host to force reconnection
      this.abortAllConnections(hostKey);
      
      // Wait a bit before allowing new connections
      await new Promise(resolve => setTimeout(resolve, this.connectionRetryDelay));
      
      return true; // Indicate that we handled the failure
    }
    
    return false; // Not a connection error we can handle
  }

  /**
   * Clear all retry counts (for connection pool stats)
   */
  clearAllRetryCounts(): void {
    // This method is called by the diagnostics API
    // Connection pool doesn't maintain retry counts, but we implement this for compatibility
    console.log('[ConnectionPool] Retry counts cleared (connection pool doesn\'t maintain retry counts)');
  }
}

// Global connection pool instance
export const connectionPool = ConnectionPool.getInstance();

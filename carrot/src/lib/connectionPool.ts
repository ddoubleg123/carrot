// Connection pool manager for HTTP/1.1 optimization
export class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: Map<string, AbortController[]> = new Map();
  private maxConnectionsPerHost = 6; // HTTP/1.1 default
  private connectionTimeout = 30000; // 30 seconds

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

    // Set up automatic cleanup
    setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }, this.connectionTimeout);

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
}

// Global connection pool instance
export const connectionPool = ConnectionPool.getInstance();

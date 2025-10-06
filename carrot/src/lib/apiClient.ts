/**
 * Robust API client with automatic retry and error handling
 */

import { fetchWithRetry, createResilientFetch, isNetworkProtocolError } from './retryUtils';
import { NetworkErrorHandler } from './networkErrorHandler';

export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retries: number;
  private headers: Record<string, string>;
  private resilientFetch: ReturnType<typeof createResilientFetch>;
  private errorHandler: NetworkErrorHandler;

  constructor(options: ApiClientOptions = {}) {
    this.baseURL = options.baseURL || '';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.headers = {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
      ...options.headers
    };
    this.resilientFetch = createResilientFetch();
    this.errorHandler = NetworkErrorHandler.getInstance();
  }

  /**
   * Make a GET request
   */
  async get<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Make a request with automatic retry and error handling
   */
  private async request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const fullUrl = this.baseURL ? `${this.baseURL}${url}` : url;
    
    try {
      const response = await this.resilientFetch(fullUrl, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text() as T;
    } catch (error) {
      const networkError = this.errorHandler.analyzeError(error as Error, fullUrl);
      
      if (networkError.retryable) {
        const handled = await this.errorHandler.handleError(networkError);
        if (handled) {
          // Retry the request after error handling
          return this.request<T>(url, options);
        }
      }
      
      throw error;
    }
  }
}

// Create a default API client instance
export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || '',
  timeout: 30000,
  retries: 3
});

// Create a specialized client for external API calls
export const externalApiClient = new ApiClient({
  timeout: 60000,
  retries: 2,
  headers: {
    'User-Agent': 'Carrot-App/1.0',
    'Accept': 'application/json'
  }
});

// Create a client for Firebase Storage requests
export const firebaseApiClient = new ApiClient({
  timeout: 45000,
  retries: 3,
  headers: {
    'Accept': '*/*',
    'Connection': 'keep-alive'
    // Note: No Cache-Control header for Firebase Storage to avoid CORS issues
  }
});

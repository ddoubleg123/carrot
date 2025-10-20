/**
 * Proxy fetch utilities for external requests
 */

interface ProxyOptions {
  timeout?: number
  userAgent?: string
  headers?: Record<string, string>
}

export async function fetchWithProxy(
  url: string, 
  options: RequestInit & ProxyOptions = {}
): Promise<Response> {
  const {
    timeout = 5000,
    userAgent = 'Mozilla/5.0 (compatible; CarrotBot/1.0)',
    headers = {},
    ...fetchOptions
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...headers
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export async function headRequest(url: string, options: ProxyOptions = {}): Promise<Response> {
  return fetchWithProxy(url, {
    ...options,
    method: 'HEAD'
  })
}

export async function getRequest(url: string, options: ProxyOptions = {}): Promise<Response> {
  return fetchWithProxy(url, {
    ...options,
    method: 'GET'
  })
}

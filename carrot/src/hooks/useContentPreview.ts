'use client'

import useSWR from 'swr'

interface ContentPreview {
  title: string
  meta: {
    domain: string
    favicon: string
    author?: string
    publishDate?: string
    readTime?: number
    canonicalUrl: string
    verified: boolean
  }
  hero?: string
  summary: string
  keyPoints: string[]
  context?: string
  excerptHtml?: string
  entities?: string[]
  timeline?: Array<{date: string, fact: string}>
}

const fetcher = async (url: string): Promise<ContentPreview> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`)
  }
  return response.json()
}

export function useContentPreview(contentId: string) {
  const { data, error, isLoading } = useSWR<ContentPreview>(
    contentId ? `/api/internal/content/${contentId}/preview` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // 5 minutes
      errorRetryCount: 2,
      errorRetryInterval: 1000,
    }
  )

  return {
    data,
    error,
    isLoading,
    isError: !!error
  }
}

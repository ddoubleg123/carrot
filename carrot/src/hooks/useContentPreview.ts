'use client'

import { useState, useEffect } from 'react'
import { ContentPreview, ContentPreviewResponse } from '@/types/content-preview'

interface UseContentPreviewReturn {
  data?: ContentPreview
  isLoading: boolean
  error?: string
}

export function useContentPreview(contentId: string): UseContentPreviewReturn {
  const [data, setData] = useState<ContentPreview | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!contentId) {
      setIsLoading(false)
      return
    }

    const fetchContent = async () => {
      try {
        setIsLoading(true)
        setError(undefined)

        const response = await fetch(`/api/internal/content/${contentId}/preview`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`)
        }

        const result: ContentPreviewResponse = await response.json()
        
        if (result.success && result.data) {
          setData(result.data)
        } else {
          throw new Error(result.error || 'Failed to load content')
        }
      } catch (err) {
        console.error('[useContentPreview] Error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchContent()
  }, [contentId])

  return {
    data,
    isLoading,
    error
  }
}
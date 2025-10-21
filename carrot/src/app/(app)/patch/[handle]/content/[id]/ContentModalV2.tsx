'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import HeaderStrip from './HeaderStrip'
import SplitContainer from './SplitContainer'
import ContentPane, { ContentPaneSkeleton } from './ContentPane'
import CommentsPane from './CommentsPane'
import { useContentPreview } from '@/hooks/useContentPreview'
import { checkLink, type LinkStatus } from '@/lib/link/checkLink'

interface ContentModalV2Props {
  contentId: string
  isOpen: boolean
  onClose: () => void
}

export default function ContentModalV2({ contentId, isOpen, onClose }: ContentModalV2Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null)
  const [accentColor, setAccentColor] = useState('#3b82f6')
  const [isCheckingLink, setIsCheckingLink] = useState(false)
  
  const { data: preview, isLoading, error } = useContentPreview(contentId)

  // Focus trap and keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    // Focus the modal when it opens
    modalRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Verify link status when preview loads
  useEffect(() => {
    if (preview && preview.meta.canonicalUrl && !linkStatus && !isCheckingLink) {
      setIsCheckingLink(true)
      checkLink(preview.meta.canonicalUrl)
        .then(status => {
          setLinkStatus(status)
        })
        .catch(error => {
          console.error('Link verification failed:', error)
        })
        .finally(() => {
          setIsCheckingLink(false)
        })
    }
  }, [preview, linkStatus, isCheckingLink])

  // Extract accent color from hero
  useEffect(() => {
    if (preview?.hero) {
      // In a real implementation, extract dominant color from image
      // For now, use a default
      setAccentColor('#3b82f6')
    }
  }, [preview?.hero])

  const handleViewSource = () => {
    if (!preview) return
    
    if (linkStatus && linkStatus.verified) {
      window.open(linkStatus.finalUrl, '_blank', 'noopener,noreferrer')
    } else if (linkStatus?.waybackUrl) {
      // Offer Wayback fallback
      if (confirm('The original source may be unavailable. Would you like to view an archived version?')) {
        window.open(linkStatus.waybackUrl, '_blank', 'noopener,noreferrer')
      }
    } else {
      window.open(preview.meta.canonicalUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    
    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: preview?.title || 'Check this out',
          url: url
        })
        return
      } catch (error) {
        // Fallback to clipboard
      }
    }
    
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      // You could add a toast notification here
      alert('Link copied to clipboard!')
    } catch (error) {
      console.error('Failed to share:', error)
    }
  }

  const handleEntityClick = (entity: string) => {
    // In a real implementation, this would search within the patch
    console.log('Search for entity:', entity)
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="max-w-[1400px] w-[92vw] max-h-[90vh] rounded-2xl bg-white shadow-2xl relative flex flex-col overflow-hidden"
        tabIndex={-1}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5 text-gray-700" />
        </button>

        {/* Header Strip */}
        {isLoading ? (
          <div className="h-16 md:h-[72px] lg:h-24 bg-slate-200 animate-pulse" />
        ) : preview ? (
          <HeaderStrip
            title={preview.title}
            heroUrl={preview.hero}
            meta={{
              domain: preview.meta.domain,
              favicon: preview.meta.favicon,
              author: preview.meta.author,
              publishDate: preview.meta.publishDate,
              readTime: preview.meta.readTime
            }}
            linkStatus={linkStatus || undefined}
            onViewSource={handleViewSource}
            onShare={handleShare}
            accentColor={accentColor}
          />
        ) : null}

        {/* Split Container - Single Scroll Area */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full overflow-y-auto">
              <ContentPaneSkeleton />
            </div>
          ) : preview ? (
            <SplitContainer
              contentPane={
                <ContentPane
                  summary={preview.summary}
                  keyFacts={preview.keyPoints.map((text, index) => ({
                    text,
                    date: preview.timeline?.[index]?.date
                  }))}
                  context={preview.context || ''}
                  entities={preview.entities}
                  excerptHtml={preview.excerptHtml}
                  citations={{
                    domain: preview.meta.domain,
                    url: preview.meta.canonicalUrl,
                    extractedAt: new Date().toISOString()
                  }}
                  isExcerptAllowed={true}
                  onEntityClick={handleEntityClick}
                />
              }
              commentsPane={
                <CommentsPane
                  comments={[]}
                  isLoading={false}
                  onPostComment={async (content) => {
                    console.log('Post comment:', content)
                  }}
                />
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <p className="text-lg text-slate-600 mb-4">
                  Failed to load content preview
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Accent Bottom Strip */}
        <div 
          className="h-1 w-full"
          style={{ backgroundColor: accentColor }}
        />
      </div>
    </div>,
    document.body
  )
}

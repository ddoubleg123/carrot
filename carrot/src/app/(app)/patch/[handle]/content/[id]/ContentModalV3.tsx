'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Share2, MessageCircle, Clock, User, Globe } from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'

interface ContentModalV3Props {
  item: DiscoveredItem
  isOpen: boolean
  onClose: () => void
}

export default function ContentModalV3({ item, isOpen, onClose }: ContentModalV3Props) {
  const [leftWidth, setLeftWidth] = useState(70) // Default 70/30 split
  const [isResizing, setIsResizing] = useState(false)
  const [dominantColor, setDominantColor] = useState('#667eea')

  // Load saved width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('modalSplit:v1')
    if (saved) {
      setLeftWidth(parseInt(saved))
    }
  }, [])

  // Save width to localStorage
  const handleWidthChange = (newWidth: number) => {
    setLeftWidth(newWidth)
    localStorage.setItem('modalSplit:v1', newWidth.toString())
  }

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.modal-container')
      if (!container) return

      const rect = container.getBoundingClientRect()
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100
      const clampedWidth = Math.max(45, Math.min(75, newLeftWidth)) // Min 45%, max 75%
      handleWidthChange(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Get hero image
  const heroImage = item.media?.hero || item.media?.source

  // Format date
  const formatDate = (date: string | Date) => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Unknown date'
    }
  }

  // Get reading time
  const readingTime = item.content?.readingTimeMin || 
    Math.max(1, Math.floor((item.content?.summary150?.length || 0) / 200))

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[1400px] w-[92vw] max-h-[90vh] p-0 rounded-2xl shadow-xl modal-container"
        style={{ '--accent': dominantColor } as React.CSSProperties}
      >
        {/* Header Strip */}
        <div className="relative h-20 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl overflow-hidden">
          {/* Hero Background */}
          {heroImage && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(${heroImage})` }}
            />
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full flex items-center justify-between px-6">
            {/* Title and Meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-white truncate">
                {item.title}
              </h1>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-300">
                {/* Domain */}
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  <span>{item.meta?.sourceDomain || 'Unknown'}</span>
                </div>
                
                {/* Author */}
                {item.meta?.author && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{item.meta.author}</span>
                  </div>
                )}
                
                {/* Date */}
                {item.meta?.publishDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(item.meta.publishDate)}</span>
                  </div>
                )}
                
                {/* Reading Time */}
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{readingTime} min read</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/70 text-white hover:bg-black/80 w-32 justify-start"
                onClick={() => window.open(item.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Source
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/70 text-white hover:bg-black/80 w-32 justify-start"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  // Show toast notification
                }}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Content Pane */}
          <div 
            className="overflow-y-auto p-6"
            style={{ width: `${leftWidth}%` }}
          >
            {/* Summary */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
              <p className="text-gray-700 leading-relaxed">
                {item.content?.summary150 || 'No summary available.'}
              </p>
            </div>

            {/* Key Points */}
            {item.content?.keyPoints && item.content.keyPoints.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Key Points</h2>
                <ul className="space-y-2">
                  {item.content.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notable Quote */}
            {item.content?.notableQuote && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Notable Quote</h2>
                <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700">
                  "{item.content.notableQuote}"
                </blockquote>
              </div>
            )}

            {/* Entities */}
            {item.content?.keyPoints && item.content.keyPoints.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Related Topics</h2>
                <div className="flex flex-wrap gap-2">
                  {item.content.keyPoints.slice(0, 8).map((point, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {point}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Source Information */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Source Information</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">Domain:</span> {item.meta?.sourceDomain || 'Unknown'}
                </div>
                {item.meta?.author && (
                  <div>
                    <span className="font-medium">Author:</span> {item.meta.author}
                  </div>
                )}
                {item.meta?.publishDate && (
                  <div>
                    <span className="font-medium">Published:</span> {formatDate(item.meta.publishDate)}
                  </div>
                )}
                <div>
                  <span className="font-medium">Reading Time:</span> {readingTime} minutes
                </div>
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          <div 
            className={`w-2 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex-shrink-0 ${
              isResizing ? 'bg-blue-300' : ''
            }`}
            onMouseDown={handleMouseDown}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-1 h-8 bg-gray-400 rounded-full" />
            </div>
          </div>

          {/* Right Comments Pane */}
          <div 
            className="overflow-y-auto border-l border-gray-200"
            style={{ width: `${100 - leftWidth}%` }}
          >
            <div className="p-6">
              {/* Comments Header */}
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
              </div>

              {/* Comment Composer */}
              <div className="mb-6">
                <textarea
                  placeholder="Write a comment..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm">Post Comment</Button>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {/* Empty State */}
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to start the conversation</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Accent Strip */}
        <div 
          className="h-1 rounded-b-2xl" 
          style={{ backgroundColor: dominantColor }}
        />
      </DialogContent>
    </Dialog>
  )
}

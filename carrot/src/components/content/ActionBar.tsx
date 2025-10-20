'use client'

import React from 'react'
import { Link2, MessageSquare, Share2, Heart, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActionBarProps {
  variant: 'overlay' | 'inline'
  onAttach?: () => void
  onDiscuss?: () => void
  onShare?: () => void
  onLike?: () => void
  onSave?: () => void
  className?: string
}

export default function ActionBar({
  variant,
  onAttach,
  onDiscuss,
  onShare,
  onLike,
  onSave,
  className = ''
}: ActionBarProps) {
  const baseClasses = variant === 'overlay' 
    ? 'backdrop-blur supports-[backdrop-filter]:bg-black/40 bg-black/60 text-white rounded-full px-2 py-1 shadow-lg'
    : 'flex items-center gap-2'

  const buttonClasses = variant === 'overlay'
    ? 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white text-white'
    : 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-gray-700'

  return (
    <div className={`${baseClasses} ${className}`} role="toolbar" aria-label="Content actions">
      {onAttach && (
        <button
          className={buttonClasses}
          onClick={onAttach}
          aria-label="Attach to discussion"
          data-tracking="action_attach"
          data-focusable
          tabIndex={0}
        >
          <Link2 className="h-4 w-4" />
          <span className="hidden md:inline">Attach</span>
        </button>
      )}
      
      {onDiscuss && (
        <button
          className={buttonClasses}
          onClick={onDiscuss}
          aria-label="Start discussion"
          data-tracking="action_discuss"
          data-focusable
          tabIndex={0}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden md:inline">Discuss</span>
        </button>
      )}
      
      {onShare && (
        <button
          className={buttonClasses}
          onClick={onShare}
          aria-label="Share content"
          data-tracking="action_share"
          data-focusable
          tabIndex={0}
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden md:inline">Share</span>
        </button>
      )}
      
      {onLike && (
        <button
          className={buttonClasses}
          onClick={onLike}
          aria-label="Like content"
          data-tracking="action_like"
          data-focusable
          tabIndex={0}
        >
          <Heart className="h-4 w-4" />
          <span className="hidden md:inline">Like</span>
        </button>
      )}
      
      {onSave && (
        <button
          className={buttonClasses}
          onClick={onSave}
          aria-label="Save content"
          data-tracking="action_save"
          data-focusable
          tabIndex={0}
        >
          <Bookmark className="h-4 w-4" />
          <span className="hidden md:inline">Save</span>
        </button>
      )}
    </div>
  )
}

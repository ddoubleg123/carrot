'use client'

import React, { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface SplitContainerProps {
  contentPane: React.ReactNode
  commentsPane: React.ReactNode
}

const STORAGE_KEY = 'modalSplit:v1'
const DEFAULT_LEFT_SIZE = 70
const DEFAULT_RIGHT_SIZE = 30
const MIN_LEFT_SIZE = 45
const MIN_RIGHT_SIZE = 25

export default function SplitContainer({ contentPane, commentsPane }: SplitContainerProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [leftSize, setLeftSize] = useState(DEFAULT_LEFT_SIZE)

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load saved split from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const { left } = JSON.parse(saved)
          if (left >= MIN_LEFT_SIZE && left <= 100 - MIN_RIGHT_SIZE) {
            setLeftSize(left)
          }
        } catch (e) {
          console.warn('Failed to parse saved split:', e)
        }
      }
    }
  }, [])

  // Save split to localStorage
  const handleResize = (sizes: number[]) => {
    const [left] = sizes
    setLeftSize(left)
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, right: 100 - left }))
    }
  }

  // Mobile: stacked layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto border-b border-slate-200">
          {contentPane}
        </div>
        <div className="flex-1 overflow-y-auto">
          {commentsPane}
        </div>
      </div>
    )
  }

  // Desktop: resizable split layout
  return (
    <PanelGroup
      direction="horizontal"
      onLayout={handleResize}
      className="h-full"
    >
      {/* Content Pane (Left) */}
      <Panel
        defaultSize={leftSize}
        minSize={MIN_LEFT_SIZE}
        maxSize={100 - MIN_RIGHT_SIZE}
        className="overflow-y-auto"
      >
        {contentPane}
      </Panel>

      {/* Resize Handle */}
      <PanelResizeHandle
        className="group relative w-2 bg-slate-100 hover:bg-slate-200 focus:bg-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize content and comments panels"
        tabIndex={0}
        onKeyDown={(e) => {
          // Keyboard resizing: Arrow keys adjust by 2%
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            const newSize = Math.max(MIN_LEFT_SIZE, leftSize - 2)
            setLeftSize(newSize)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            const newSize = Math.min(100 - MIN_RIGHT_SIZE, leftSize + 2)
            setLeftSize(newSize)
          }
        }}
      >
        {/* Visual indicator */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-slate-300 group-hover:bg-slate-400 group-focus:bg-blue-500 transition-colors" />
        
        {/* Hover hint */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            Drag to resize
          </div>
        </div>
      </PanelResizeHandle>

      {/* Comments Pane (Right) */}
      <Panel
        defaultSize={100 - leftSize}
        minSize={MIN_RIGHT_SIZE}
        maxSize={100 - MIN_LEFT_SIZE}
        className="overflow-y-auto bg-slate-50"
      >
        {commentsPane}
      </Panel>
    </PanelGroup>
  )
}

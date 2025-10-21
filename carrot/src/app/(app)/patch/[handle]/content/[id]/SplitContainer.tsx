'use client'

import React, { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ContentPane from './ContentPane'
import CommentsPane from './CommentsPane'
import { ContentPreview } from '@/types/content-preview'

interface SplitContainerProps {
  children?: React.ReactNode
}

export default function SplitContainer({ children }: SplitContainerProps) {
  const [leftWidth, setLeftWidth] = useState(65) // Default 65/35 split
  const [rightWidth, setRightWidth] = useState(35)

  // Load saved split width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('modalSplit:v1')
    if (saved) {
      try {
        const { left, right } = JSON.parse(saved)
        setLeftWidth(left)
        setRightWidth(right)
      } catch (error) {
        console.warn('Failed to parse saved split width:', error)
      }
    }
  }, [])

  // Save split width to localStorage
  const handleResize = (sizes: number[]) => {
    const [left, right] = sizes
    setLeftWidth(left)
    setRightWidth(right)
    
    // Save to localStorage
    localStorage.setItem('modalSplit:v1', JSON.stringify({ left, right }))
  }

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={handleResize}
      className="h-full"
    >
      {/* Left Panel - Content */}
      <Panel defaultSize={leftWidth} minSize={45} maxSize={85}>
        <div className="h-full overflow-hidden">
          {children}
        </div>
      </Panel>
      
      {/* Resize Handle */}
      <PanelResizeHandle className="w-2 bg-slate-200 hover:bg-slate-300 transition-colors cursor-col-resize focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50" />
      
      {/* Right Panel - Comments */}
      <Panel defaultSize={rightWidth} minSize={25} maxSize={55}>
        <div className="h-full overflow-hidden">
          <CommentsPane contentId="" />
        </div>
      </Panel>
    </PanelGroup>
  )
}
'use client'

import React from 'react'
import { DiscoveredItem } from '@/types/discovered-content'
import UnifiedContentModal from '@/components/modal/UnifiedContentModal'

interface ContentModalProps {
  item: DiscoveredItem | null
  isOpen: boolean
  onClose: () => void
}

export default function ContentModal({ item, isOpen, onClose }: ContentModalProps) {
  return (
    <UnifiedContentModal
      item={item}
      isOpen={isOpen}
      onClose={onClose}
      source="group"
    />
  )
}

'use client'

import React from 'react'
import { DiscoveredItem } from '@/types/discovered-content'
import ContentModalV3 from '@/components/modal/ContentModalV3'

interface ContentModalProps {
  item: DiscoveredItem | null
  isOpen: boolean
  onClose: () => void
}

export default function ContentModal({ item, isOpen, onClose }: ContentModalProps) {
  return (
    <ContentModalV3
      item={item}
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}

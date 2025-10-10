'use client'

import React from 'react'
import { FileText, Play, Image as ImageIcon, File } from 'lucide-react'

interface GeneratedCoverProps {
  title: string
  domain: string
  type: 'article' | 'video' | 'pdf' | 'image' | 'text'
  dominant?: string
}

export function GeneratedCover({ title, domain, type, dominant = '#0A5AFF' }: GeneratedCoverProps) {
  const d2 = '#0B0B0F'
  
  // Get type icon
  const getTypeIcon = () => {
    switch (type) {
      case 'video': return '▶'
      case 'pdf': return '📄'
      case 'image': return '🖼'
      case 'article': return '📝'
      case 'text': return '📄'
      default: return '📄'
    }
  }

  // Convert hex to darker tone
  const darkenColor = (hex: string, percent: number) => {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) - amt
    const G = (num >> 8 & 0x00FF) - amt
    const B = (num & 0x0000FF) - amt
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
  }

  const darkerDominant = darkenColor(dominant, 20)

  return (
    <svg 
      viewBox="0 0 1600 900" 
      xmlns="http://www.w3.org/2000/svg" 
      role="img" 
      aria-label={`${type} from ${domain}`}
      className="w-full h-full"
    >
      <defs>
        <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={dominant} />
          <stop offset="100%" stopColor={darkerDominant} />
        </linearGradient>
        <pattern id={`pattern-${title}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.08)" />
          <circle cx="0" cy="0" r="1" fill="rgba(255,255,255,0.04)" />
        </pattern>
      </defs>
      
      {/* Background gradient */}
      <rect width="100%" height="100%" fill={`url(#gradient-${title})`} />
      
      {/* Subtle pattern overlay */}
      <rect width="100%" height="100%" fill={`url(#pattern-${title})`} />
      
      {/* Type icon pill - top left */}
      <rect x="24" y="24" width="48" height="24" rx="12" fill="rgba(255,255,255,0.15)" />
      <text x="48" y="39" textAnchor="middle" fill="white" fontSize="12" fontFamily="system-ui">
        {getTypeIcon()}
      </text>
      
      {/* Domain chip - bottom left */}
      <rect x="24" y="852" width="120" height="24" rx="12" fill="rgba(0,0,0,0.15)" />
      <text x="84" y="867" textAnchor="middle" fill="white" fontSize="11" fontFamily="system-ui">
        {domain}
      </text>
    </svg>
  )
}

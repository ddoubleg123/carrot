'use client'

import React, { useMemo } from 'react'

interface GeneratedCoverProps {
  domain: string
  type: 'article' | 'video' | 'pdf' | 'image' | 'text'
  dominant?: string
  className?: string
}

const TYPE_ICONS = {
  article: '📄',
  video: '🎥',
  pdf: '📋',
  image: '🖼️',
  text: '📝'
}

const TYPE_COLORS = {
  article: '#3B82F6',
  video: '#EF4444',
  pdf: '#F59E0B',
  image: '#10B981',
  text: '#8B5CF6'
}

export default function GeneratedCover({ 
  domain, 
  type, 
  dominant = '#667eea',
  className = ''
}: GeneratedCoverProps) {
  
  const svgContent = useMemo(() => {
    // Convert hex to RGB for gradients
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 102, g: 126, b: 234 }
    }
    
    const rgb = hexToRgb(dominant)
    const darkerRgb = {
      r: Math.max(0, rgb.r - 40),
      g: Math.max(0, rgb.g - 40),
      b: Math.max(0, rgb.b - 40)
    }
    
    const icon = TYPE_ICONS[type]
    const iconColor = TYPE_COLORS[type]
    
    // Clean domain for display - handle undefined/empty domains
    const safeDomain = domain || 'carrot.app'
    const displayDomain = safeDomain.replace('www.', '').split('.')[0]
    
    return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(${rgb.r},${rgb.g},${rgb.b});stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(${darkerRgb.r},${darkerRgb.g},${darkerRgb.b});stop-opacity:1" />
          </linearGradient>
          <pattern id="dots" patternUnits="userSpaceOnUse" width="40" height="40">
            <circle cx="20" cy="20" r="1" fill="white" opacity="0.1"/>
          </pattern>
        </defs>
        
        <!-- Background gradient -->
        <rect width="100%" height="100%" fill="url(#grad)" />
        
        <!-- Subtle dot pattern -->
        <rect width="100%" height="100%" fill="url(#dots)" />
        
        <!-- Type icon (top left) -->
        <text x="60" y="80" font-size="32" fill="white" opacity="0.3" font-family="system-ui">
          ${icon}
        </text>
        
        <!-- Domain chip (bottom left) -->
        <rect x="60" y="600" rx="12" ry="12" width="120" height="24" fill="rgba(255,255,255,0.15)" />
        <text x="120" y="616" font-size="12" fill="white" text-anchor="middle" font-family="system-ui" font-weight="500">
          ${displayDomain}
        </text>
        
        <!-- Subtle geometric pattern -->
        <circle cx="1100" cy="150" r="80" fill="rgba(255,255,255,0.05)" />
        <circle cx="1200" cy="300" r="60" fill="rgba(255,255,255,0.03)" />
        <rect x="1000" y="500" width="120" height="120" rx="20" fill="rgba(255,255,255,0.04)" transform="rotate(15 1060 560)" />
      </svg>
    `
  }, [domain, type, dominant])
  
  return (
    <div 
      className={`absolute inset-0 flex items-center justify-center ${className}`}
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svgContent)}")` }}
    />
  )
}
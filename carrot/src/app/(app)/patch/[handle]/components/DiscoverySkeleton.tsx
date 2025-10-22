/**
 * Discovery Skeleton Component
 * Shows "in-process" skeleton that morphs into real cards
 */

import React from 'react'

interface DiscoverySkeletonProps {
  isActive: boolean
  currentStatus?: string
  className?: string
  id?: string
}

export default function DiscoverySkeleton({ 
  isActive, 
  currentStatus = "Discovering...",
  className = "",
  id
}: DiscoverySkeletonProps) {
  return (
    <div 
      id={id}
      className={`rounded-2xl border border-[#E6E8EC] bg-white p-5 md:p-6 shadow-sm ${className}`}
    >
      {/* Hero skeleton with pulsing animation */}
      <div className="aspect-[16/9] bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-xl mb-3 animate-pulse relative overflow-hidden">
        {/* Animated shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        
        {/* Status overlay */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-700">{currentStatus}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Title skeleton */}
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
      
      {/* Summary skeleton */}
      <div className="space-y-1 mb-3">
        <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
      </div>
      
      {/* Pills skeleton */}
      <div className="flex gap-2 mb-3">
        <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
      </div>
      
      {/* Meta skeleton */}
      <div className="flex gap-3">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
      
      {/* Action buttons skeleton */}
      <div className="mt-3 pt-3 border-t border-[#E6E8EC]">
        <div className="flex gap-2">
          <div className="flex-1 h-8 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 h-8 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, Users, MessageSquare, Calendar, BookOpen } from 'lucide-react'

interface Patch {
  id: string
  handle: string
  name: string
  description: string
  tags: string[]
  theme?: {
    bg?: string
    accent?: string
  }
  _count: {
    members: number
    posts: number
    events: number
    sources: number
  }
}

interface PatchHeaderProps {
  patch: Patch
}

export default function PatchHeader({ patch }: PatchHeaderProps) {
  const [isJoined, setIsJoined] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleJoinLeave = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement join/leave API call
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setIsJoined(!isJoined)
    } catch (error) {
      console.error('Failed to join/leave patch:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="py-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* Main content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
              {patch.name}
            </h1>
            <Badge variant="secondary" className="text-sm">
              r/{patch.handle}
            </Badge>
          </div>
          
          <p className="text-lg text-gray-700 mb-6 max-w-3xl">
            {patch.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {patch.tags.map((tag) => (
              <Badge 
                key={tag} 
                variant="outline" 
                className="text-sm px-3 py-1"
                style={{ 
                  borderColor: patch.theme?.accent || '#0A5AFF',
                  color: patch.theme?.accent || '#0A5AFF'
                }}
              >
                #{tag}
              </Badge>
            ))}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{patch._count.members.toLocaleString()} members</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>{patch._count.posts.toLocaleString()} posts</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{patch._count.events.toLocaleString()} events</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{patch._count.sources.toLocaleString()} sources</span>
            </div>
          </div>
        </div>

        {/* Join/Leave button */}
        <div className="flex-shrink-0">
          <Button
            onClick={handleJoinLeave}
            disabled={isLoading}
            className={`px-8 py-3 text-base font-semibold transition-all duration-200 ${
              isJoined 
                ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' 
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
            style={{
              backgroundColor: isJoined ? undefined : (patch.theme?.accent || '#FF6A00'),
              borderColor: patch.theme?.accent || '#FF6A00',
            }}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Heart className={`w-4 h-4 ${isJoined ? 'fill-current' : ''}`} />
                <span>{isJoined ? 'Leave' : 'Join'}</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  Bookmark, 
  MoreHorizontal,
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react'

interface User {
  id: string
  name?: string | null
  username?: string | null
  profilePhoto?: string | null
  image?: string | null
  country?: string | null
}

interface Post {
  id: string
  type: 'CARROT' | 'TEXT' | 'LINK' | 'IMAGE' | 'VIDEO'
  title?: string | null
  body?: string | null
  url?: string | null
  tags: string[]
  metrics: {
    likes: number
    comments: number
    reposts: number
    views: number
  }
  createdAt: Date
  author: User
}

interface Patch {
  id: string
  name: string
  handle: string
}

interface PostFeedProps {
  patch: Patch
  posts?: Post[]
}

export default function PostFeed({ patch, posts = [] }: PostFeedProps) {
  // Mock data if no posts provided
  const mockPosts: Post[] = posts.length > 0 ? posts : [
    {
      id: '1',
      type: 'TEXT',
      title: 'New research paper added',
      body: '"Term Limits and Congressional Effectiveness" by Dr. Sarah Chen',
      createdAt: new Date(),
      author: { id: '1', name: 'Dr. Sarah Chen', username: 'sarahchen' },
      metrics: { likes: 12, comments: 3, reposts: 1, views: 45 },
      tags: ['research', 'academic']
    },
    {
      id: '2',
      type: 'TEXT',
      title: 'New discussion started',
      body: '"What would be the ideal term limit structure?"',
      createdAt: new Date(),
      author: { id: '2', name: 'John Doe', username: 'johndoe' },
      metrics: { likes: 8, comments: 5, reposts: 2, views: 32 },
      tags: ['discussion', 'policy']
    }
  ];

  const displayPosts = posts.length > 0 ? posts : mockPosts;
  const [sortBy, setSortBy] = useState<'top' | 'new' | 'ending-soon'>('top')
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())

  // Sort posts based on selected criteria
  const sortedPosts = displayPosts.sort((a, b) => {
    switch (sortBy) {
      case 'new':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'ending-soon':
        // For now, just sort by engagement (likes + comments)
        const aEngagement = a.metrics.likes + a.metrics.comments
        const bEngagement = b.metrics.likes + b.metrics.comments
        return bEngagement - aEngagement
      case 'top':
      default:
        // Sort by total engagement (likes + comments + reposts)
        const aTotal = a.metrics.likes + a.metrics.comments + a.metrics.reposts
        const bTotal = b.metrics.likes + b.metrics.comments + b.metrics.reposts
        return bTotal - aTotal
    }
  })

  const handleLike = (postId: string) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const handleSave = (postId: string) => {
    setSavedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'CARROT':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'LINK':
        return <Share2 className="w-4 h-4 text-blue-500" />
      case 'IMAGE':
        return <div className="w-4 h-4 bg-green-500 rounded"></div>
      case 'VIDEO':
        return <div className="w-4 h-4 bg-purple-500 rounded"></div>
      default:
        return <MessageSquare className="w-4 h-4 text-gray-500" />
    }
  }

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case 'CARROT':
        return 'Carrot'
      case 'LINK':
        return 'Link'
      case 'IMAGE':
        return 'Image'
      case 'VIDEO':
        return 'Video'
      default:
        return 'Text'
    }
  }

  const isEndingSoon = (post: Post) => {
    // Simple logic: posts with high engagement in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const isRecent = new Date(post.createdAt) > oneDayAgo
    const hasHighEngagement = (post.metrics.likes + post.metrics.comments) > 10
    return isRecent && hasHighEngagement
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Posts</h2>
        <p className="text-gray-600">Community discussions and content</p>
      </div>

      {/* Sort Tabs */}
      <Tabs value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
        <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 h-auto border-b border-gray-200">
          <TabsTrigger
            value="top"
            className="flex items-center gap-2 px-6 py-4 text-base font-medium data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 rounded-none border-b-2 border-transparent hover:text-gray-700 transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Top</span>
          </TabsTrigger>
          <TabsTrigger
            value="new"
            className="flex items-center gap-2 px-6 py-4 text-base font-medium data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 rounded-none border-b-2 border-transparent hover:text-gray-700 transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span>New</span>
          </TabsTrigger>
          <TabsTrigger
            value="ending-soon"
            className="flex items-center gap-2 px-6 py-4 text-base font-medium data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 rounded-none border-b-2 border-transparent hover:text-gray-700 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Ending Soon</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Posts */}
      <div className="space-y-4">
        {sortedPosts.length === 0 ? (
          <Card className="rounded-2xl border border-gray-200">
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
              <p className="text-gray-600">
                Be the first to start a discussion in {patch.name}!
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedPosts.map((post) => (
            <Card key={post.id} className="rounded-2xl border border-gray-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Post Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.author.profilePhoto || post.author.image || '/default-avatar.png'}
                        alt={post.author.name || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">
                            {post.author.name || post.author.username || 'Anonymous'}
                          </p>
                          {post.author.country && (
                            <span className="text-sm text-gray-500">🇺🇸</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {post.createdAt.toLocaleDateString()} • {getPostTypeLabel(post.type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEndingSoon(post) && (
                        <Badge className="bg-orange-500 text-white text-xs">
                          Ending Soon
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="space-y-3">
                    {post.title && (
                      <h3 className="text-lg font-semibold text-gray-900">
                        {post.title}
                      </h3>
                    )}
                    {post.body && (
                      <p className="text-gray-700 leading-relaxed">
                        {post.body}
                      </p>
                    )}
                    {post.url && (
                      <div className="bg-gray-50 rounded-lg p-3 border">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          {post.url}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Engagement */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-2 ${
                          likedPosts.has(post.id) ? 'text-red-500' : 'text-gray-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                        <span>{post.metrics.likes}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-gray-500"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{post.metrics.comments}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-gray-500"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{post.metrics.reposts}</span>
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSave(post.id)}
                      className={`${
                        savedPosts.has(post.id) ? 'text-orange-500' : 'text-gray-500'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${savedPosts.has(post.id) ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {sortedPosts.length > 0 && (
        <div className="text-center">
          <Button variant="outline" size="lg">
            Load More Posts
          </Button>
        </div>
      )}
    </div>
  )
}

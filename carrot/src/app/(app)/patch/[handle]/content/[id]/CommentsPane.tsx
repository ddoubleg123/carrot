'use client'

import React, { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentsPaneProps {
  contentId: string
}

export default function CommentsPane({ contentId }: CommentsPaneProps) {
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Array<{
    id: string
    author: string
    content: string
    createdAt: string
  }>>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return

    // TODO: Implement comment submission
    const newComment = {
      id: Date.now().toString(),
      author: 'You',
      content: comment,
      createdAt: new Date().toISOString()
    }

    setComments(prev => [newComment, ...prev])
    setComment('')
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussion
        </h3>
      </div>

      {/* Comment Composer - Sticky at top */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="min-h-[80px] resize-none"
            maxLength={500}
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">
              {comment.length}/500
            </span>
            <Button 
              type="submit" 
              size="sm"
              disabled={!comment.trim()}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Post
            </Button>
          </div>
        </form>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-slate-900 mb-2">Start the discussion</h4>
            <p className="text-slate-600 text-sm">
              Be the first to share your thoughts on this content.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {comment.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{comment.author}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
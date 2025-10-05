"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  likes: number;
  isLiked: boolean;
}

interface CommentsPanelProps {
  postId: string;
  onClose: () => void;
}

export default function CommentsPanel({ postId, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Optimized comment fetching with caching
  const fetchComments = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`, {
        signal: abortControllerRef.current.signal,
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Failed to load comments');
        console.error('Comments fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchComments]);

  const canPost = text.trim().length > 0 && text.trim().length <= 500;

  const submitComment = useCallback(async () => {
    if (!canPost || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          content: text.trim(),
        }),
      });

      if (response.ok) {
        const newComment = await response.json();
        setComments(prev => [newComment, ...prev]);
        setText('');
      } else {
        throw new Error('Failed to post comment');
      }
    } catch (err) {
      console.error('Comment submission error:', err);
      setError('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [postId, text, canPost, isSubmitting]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <h3 className="font-semibold text-sm">Comments</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X size={14} />
        </Button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 text-center text-red-600 text-sm">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No comments yet. Be the first!
          </div>
        ) : (
          <div className="divide-y">
            {comments.map((comment) => (
              <div key={comment.id} className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                    {comment.author.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{comment.author.name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mt-1">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment Input */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-end space-x-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Write a comment..."
            className="flex-1 min-h-[40px] max-h-[100px] resize-none rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <Button
            onClick={submitComment}
            disabled={!canPost || isSubmitting}
            size="sm"
            className="px-3 py-2"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {text.length}/500 characters
        </div>
      </div>
    </div>
  );
}

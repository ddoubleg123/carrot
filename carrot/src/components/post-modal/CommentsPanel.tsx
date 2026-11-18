"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import RichComposer from "@/components/messaging/RichComposer";
import CommentBody from "@/components/messaging/CommentBody";
import { decodeComment, encodeComment, publishComment } from "@/components/messaging/commentCodec";

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
  pending?: boolean;
  failed?: boolean;
  parentId?: string;
}

interface CommentsPanelProps {
  postId: string;
  caption?: string;
  onClose: () => void;
  onCountChange?: (count: number) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

function commentParentId(comment: Comment) {
  return comment.parentId || decodeComment(comment.content).parentId;
}

function threadRoots(comments: Comment[]) {
  const ids = new Set(comments.map((comment) => comment.id));
  return comments.filter((comment) => {
    const parentId = commentParentId(comment);
    return !parentId || !ids.has(parentId);
  });
}

function threadChildren(comments: Comment[], parentId: string) {
  return comments
    .filter((comment) => commentParentId(comment) === parentId)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function CommentThread({
  comment,
  comments,
  depth,
  onReply,
}: {
  comment: Comment;
  comments: Comment[];
  depth: number;
  onReply: (comment: Comment) => void;
}) {
  const children = threadChildren(comments, comment.id);
  const canReply = !comment.pending && !comment.failed && !comment.id.startsWith('pending-');
  return (
    <div className={depth > 0 ? 'ml-8 border-l border-orange-100' : 'border-b'}>
      <div className="p-4">
        <div className="flex items-start space-x-3">
          {comment.author.avatar ? (
            <img src={comment.author.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium">
              {(comment.author.name || 'Someone').charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">{comment.author.name || 'Someone'}</span>
              <span className="text-xs text-gray-500">
                {comment.pending ? 'Posting' : comment.failed ? "Couldn't post" : new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-1 text-sm text-gray-800">
              <CommentBody content={comment.content} />
            </div>
            {canReply ? (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-orange-700 hover:underline"
                onClick={() => onReply(comment)}
              >
                Reply
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {children.map((child) => (
        <CommentThread key={child.id} comment={child} comments={comments} depth={depth + 1} onReply={onReply} />
      ))}
    </div>
  );
}

export default function CommentsPanel({ postId, caption, onClose, onCountChange, expanded = false, onToggleExpand }: CommentsPanelProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchSeq = useRef(0);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  // Optimized comment fetching with caching
  const fetchComments = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const seq = ++fetchSeq.current;
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
      if (seq !== fetchSeq.current) return;
      const next = data.comments || [];
      const count = typeof data.total === 'number' ? data.total : next.length;
      setComments((prev) => {
        const local = prev.filter((comment) => comment.pending || comment.failed);
        return [...local, ...next];
      });
      setTotal(count);
      onCountChangeRef.current?.(count);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Comments{total > 0 ? ` · ${total}` : ''}
          </h3>
          <div className="flex items-center gap-1">
            {onToggleExpand ? (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                aria-label={expanded ? 'Show more of the post' : 'Expand comments over the post'}
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {expanded ? 'Show post' : 'Expand'}
              </button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              aria-label="Hide comments"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
        {caption ? (
          <p className="mt-3 text-sm leading-relaxed text-gray-800">{caption}</p>
        ) : null}
      </div>

      {/* Comments List */}
      <div className="min-h-0 flex-1 overflow-auto">
        {error && (
          <div className="p-4 text-center text-red-600 text-sm">
            {error}
          </div>
        )}
        
        {loading && comments.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No comments yet. Be the first!
          </div>
        ) : (
          <div>
            {threadRoots(comments).map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                comments={comments}
                depth={0}
                onReply={(target) => {
                  setReplyTo(target);
                  setFocusToken((token) => token + 1);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {replyTo ? (
        <div className="flex items-center justify-between border-t bg-orange-50 px-4 py-2 text-xs text-orange-800">
          <span>Replying to {replyTo.author.name || 'Someone'}</span>
          <button type="button" className="font-medium hover:underline" onClick={() => setReplyTo(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      <RichComposer
        variant="reply"
        placeholder={replyTo ? `Reply to ${replyTo.author.name || 'Someone'}...` : 'Write a reply...'}
        submitLabel="Reply"
        focusToken={focusToken}
        onSend={({ text, attachment }) => {
          const me = session?.user as { id?: string; name?: string; username?: string; profilePhoto?: string; image?: string } | undefined;
          const localId = `pending-${crypto.randomUUID()}`;
          const parentId = replyTo?.id;
          const previewUrl = attachment?.file ? URL.createObjectURL(attachment.file) : attachment?.url;
          const media = previewUrl && attachment ? { kind: attachment.kind, url: previewUrl } : undefined;
          setComments((prev) => [{
            id: localId,
            content: encodeComment(text, media, undefined, parentId),
            parentId,
            author: {
              id: me?.id || 'me',
              name: me?.name || me?.username || 'You',
              avatar: me?.profilePhoto || me?.image,
            },
            createdAt: new Date().toISOString(),
            likes: 0,
            isLiked: false,
            pending: true,
          }, ...prev]);
          const previousCount = total;
          const nextCount = previousCount + 1;
          setTotal(nextCount);
          onCountChangeRef.current?.(nextCount);
          setError(null);
          setReplyTo(null);
          fetchSeq.current += 1;
          void publishComment(postId, text, attachment, parentId)
            .then((saved) => {
              if (attachment?.file && previewUrl) URL.revokeObjectURL(previewUrl);
              setComments((prev) => prev.map((comment) => (
                comment.id === localId ? { ...saved, parentId, pending: false, failed: false } : comment
              )));
            })
            .catch(() => {
              setComments((prev) => prev.map((comment) => (
                comment.id === localId ? { ...comment, pending: false, failed: true } : comment
              )));
              setTotal(previousCount);
              onCountChangeRef.current?.(previousCount);
            });
        }}
      />
    </div>
  );
}

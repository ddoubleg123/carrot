"use client";

import React, { useMemo, useState } from "react";
import { ChatBubbleOvalLeftIcon as ChatBubbleLeftIcon, ShareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import AudioPlayerCard from "../../../../components/AudioPlayerCard";
import CFVideoPlayer from "../../../../components/CFVideoPlayer";
import VideoPlayer from "./VideoPlayer";
import EditPostModal from "../../../../components/EditPostModal";

export type VoteType = "carrot" | "stick" | null;

export type Stats = {
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  carrots?: number;
  sticks?: number;
};

export interface CommitmentCardProps {
  id: string;
  content: string;
  author: {
    name: string;
    username: string;
    avatar?: string | null;
    flag?: string;
    id?: string;
  };
  location: { zip: string; city?: string; state?: string };
  stats: Stats;
  userVote?: VoteType;
  onVote?: (id: string, vote: VoteType) => void;
  onDelete?: (id: string) => void;
  onBlock?: (id: string) => void;
  timestamp?: string;
  imageUrls?: string[];
  gifUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  // Cloudflare Stream
  cfUid?: string | null;
  cfPlaybackUrlHls?: string | null;
  captionVttUrl?: string | null;
  // Audio
  audioUrl?: string | null;
  audioTranscription?: string | null;
  transcriptionStatus?: string | null;
  // Upload state
  uploadStatus?: "uploading" | "uploaded" | "processing" | "ready" | null;
  uploadProgress?: number | null;
  // Ownership
  currentUserId?: string;
  // Edit metadata (optional if fetched from server)
  editedAt?: string | null;
  editCount?: number | null;
  // Extras used by TestDashboardClient and legacy props (optional)
  carrotText?: string;
  stickText?: string;
  videoThumbnail?: string | null;
  videoTranscriptionStatus?: string | null;
  audioDurationSeconds?: number | null;
  emoji?: string | null;
  // Gradient styling (optional)
  gradientFromColor?: string | null;
  gradientToColor?: string | null;
  gradientViaColor?: string | null;
  gradientDirection?: string | null;
  innerBoxColor?: string | null;
}

export default function CommitmentCard(props: CommitmentCardProps) {
  const {
    id,
    author,
    stats,
    timestamp,
    imageUrls = [],
    gifUrl,
    videoUrl,
    thumbnailUrl,
    cfUid,
    cfPlaybackUrlHls,
    captionVttUrl,
    audioUrl,
    audioTranscription,
    transcriptionStatus,
    uploadStatus,
    uploadProgress,
    currentUserId,
  } = props;

  // Local content and edit state (kept minimal to avoid bloating the card)
  const [content, setContent] = useState<string>(props.content || "");
  const [editedAt, setEditedAt] = useState<string | null | undefined>(props.editedAt);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isOwnPost = useMemo(() => Boolean(currentUserId && author?.id && currentUserId === author.id), [currentUserId, author?.id]);
  const displayTime = useMemo(() => {
    const d = timestamp ? new Date(timestamp) : new Date();
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }, [timestamp]);

  return (
    <div className="bg-transparent">
      <div className="bg-white/95 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100">
            {author?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatar} alt={author?.username || "user"} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-900 truncate">
                  {author?.username ? (author.username.startsWith("@") ? author.username : `@${author.username}`) : "@user"}
                </span>
                <span className="text-xs text-gray-500">• {displayTime}</span>
                {editedAt ? (
                  <span className="text-xs text-gray-500" title={new Date(editedAt).toLocaleString()}>• Edited</span>
                ) : null}
              </div>
              <div className="relative">
                <button className="p-1 text-gray-500 hover:text-gray-700" aria-label="More" onClick={() => setIsMenuOpen(v => !v)}>
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-md border shadow z-10">
                    {isOwnPost ? (
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { setIsMenuOpen(false); setIsEditOpen(true); }}
                      >
                        Edit
                      </button>
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">No actions</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {content ? (
          <div className="mt-3 text-[15px] text-gray-900 whitespace-pre-wrap break-words">{content}</div>
        ) : null}

        {/* Images / GIF */}
        {gifUrl ? (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gifUrl} alt="gif" className="w-full rounded-xl" />
          </div>
        ) : imageUrls && imageUrls.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {imageUrls.slice(0, 4).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`img-${i}`} className="w-full h-48 object-cover rounded-xl" />
            ))}
          </div>
        ) : null}

        {/* Video */}
        {(cfUid || cfPlaybackUrlHls || videoUrl) && (
          <div className="mt-3">
            {cfUid || cfPlaybackUrlHls ? (
              <CFVideoPlayer
                uid={cfUid || undefined}
                playbackUrlHls={cfPlaybackUrlHls || undefined}
                poster={thumbnailUrl || undefined}
                autoPlay
                muted
                loop
                controls
                trackSrc={captionVttUrl || undefined}
              />
            ) : (
              <VideoPlayer
                videoUrl={videoUrl || ""}
                thumbnailUrl={thumbnailUrl || undefined}
                postId={id}
                initialTranscription={audioTranscription || undefined}
                transcriptionStatus={transcriptionStatus || undefined}
                uploadStatus={uploadStatus || null}
                uploadProgress={uploadProgress || 0}
              />
            )}
          </div>
        )}

        {/* Audio */}
        {audioUrl && (
          <div className="mt-3">
            <AudioPlayerCard audioUrl={audioUrl} avatarUrl={author?.avatar || undefined} seed={id || author?.id} promoJingleUrl="/carrotnom.mp3" />
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
              <ChatBubbleLeftIcon className="h-5 w-5" />
              <span className="text-sm">{stats.comments}</span>
            </button>
            <button className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
              <ShareIcon className="h-5 w-5" />
              <span className="text-sm">Share</span>
            </button>
          </div>
          <div className="text-xs text-gray-500">{stats.views.toLocaleString()} views</div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditPostModal
        postId={id}
        initialContent={content}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSaved={(nextContent, meta) => {
          setContent(nextContent);
          if (meta?.editedAt) setEditedAt(meta.editedAt);
        }}
      />
    </div>
  );
}
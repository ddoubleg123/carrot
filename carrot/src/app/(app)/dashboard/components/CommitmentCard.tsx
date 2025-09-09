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

"use client";

import React, { useMemo } from "react";
import { ChatBubbleOvalLeftIcon as ChatBubbleLeftIcon, ShareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import AudioPlayerCard from "../../../../components/AudioPlayerCard";
import CFVideoPlayer from "../../../../components/CFVideoPlayer";
import VideoPlayer from "./VideoPlayer";

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
  audioDurationSeconds?: number | null;
  audioTranscription?: string | null;
  transcriptionStatus?: string | null;
  // Upload state
  uploadStatus?: "uploading" | "uploaded" | "processing" | "ready" | null;
  uploadProgress?: number | null;
  // Ownership
  currentUserId?: string;
  // transient status
  status?: "processing" | "failed" | string | null;
}

export default function CommitmentCard(props: CommitmentCardProps) {
  const {
    id,
    content,
    author,
    location,
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
    currentUserId,
    uploadStatus,
    uploadProgress,
  } = props;

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
              </div>
              <div className="flex items-center gap-2">
                {!isOwnPost && (
                  <button className="px-3 py-1 text-xs rounded-full border border-orange-300 text-orange-600 hover:bg-orange-50">Follow</button>
                )}
                <button className="p-1 text-gray-500 hover:text-gray-700" aria-label="More">
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
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
    </div>
  );
}
 

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
  audioDurationSeconds?: number | null;
  audioTranscription?: string | null;
  transcriptionStatus?: string | null;
  // Gradients / style (optional)
  gradientFromColor?: string | null;
  gradientToColor?: string | null;
  gradientViaColor?: string | null;
  gradientDirection?: string | null;
  // Upload state
  uploadStatus?: "uploading" | "uploaded" | "processing" | "ready" | null;
  uploadProgress?: number | null;
  // Ownership
  currentUserId?: string;
  // transient status
  status?: "processing" | "failed" | string | null;
}

export default function CommitmentCard(props: CommitmentCardProps) {
  const {
    id,
    content,
    author,
    location,
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
    audioDurationSeconds,
    audioTranscription,
    transcriptionStatus,
    currentUserId,
  } = props;

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
              </div>
              <div className="flex items-center gap-2">
                {!isOwnPost && (
                  <button className="px-3 py-1 text-xs rounded-full border border-orange-300 text-orange-600 hover:bg-orange-50">Follow</button>
                )}
                <button className="p-1 text-gray-500 hover:text-gray-700" aria-label="More">
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
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
                uploadStatus={props.uploadStatus || null}
                uploadProgress={props.uploadProgress || 0}
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
    </div>
  );
}
 
  HandThumbDownIcon,
  TrashIcon,
  NoSymbolIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { 
  HeartIcon as HeartIconSolid,
  BookmarkIcon as BookmarkIconSolid,
  CheckBadgeIcon,
  HandThumbUpIcon as HandThumbUpIconSolid,
  HandThumbDownIcon as HandThumbDownIconSolid
} from '@heroicons/react/24/solid';
import { useState, useRef, useEffect } from 'react';
// Temporarily disable for testing gradient changes
// import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import AudioPlayerCard from '../../../../components/AudioPlayerCard';
// ... rest of the code remains the same ...

              {/* Audio */}
              {audioUrl && (
                <div className="my-2 mx-3 sm:mx-5 flex justify-center max-w-full min-w-0">
                  <AudioPlayerCard
                    audioUrl={audioUrl}
                    avatarUrl={author?.avatar || undefined}
                    seed={id || author?.id}
                    promoJingleUrl="/carrotnom.mp3"
                  />
                </div>
              )}
      )}

      {(cfUid || cfPlaybackUrlHls || videoUrl) && (
        <div className="my-2 mx-3 sm:mx-5 flex justify-center max-w-full min-w-0">
          <div className="relative rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5 bg-transparent w-full max-w-full sm:max-w-[550px] mx-auto min-w-0">
            {(cfUid || cfPlaybackUrlHls) ? (
              (() => { try { console.debug('[CommitmentCard] render CF', { id, cfUid, cfPlaybackUrlHls, videoUrl }); } catch {} return null; })(),
              <CFVideoPlayer
                uid={cfUid || undefined}
                playbackUrlHls={cfPlaybackUrlHls || undefined}
                poster={thumbnailUrl || videoThumbnail || undefined}
                autoPlay
                muted
                loop
                controls
                trackSrc={captionVttUrl || undefined}
              />
            ) : (
              <VideoPlayer
                videoUrl={videoUrl || ''}
                thumbnailUrl={thumbnailUrl || videoThumbnail}
                postId={id}
                initialTranscription={audioTranscription}
                transcriptionStatus={videoTranscriptionStatus || transcriptionStatus}
                uploadStatus={uploadStatus || null}
                uploadProgress={uploadProgress || 0}
              />
            )}
          </div>
        </div>
      )}

      {/* Media Tools Panel placeholder (now toggled from action bar) */}
      {/* Panel will be rendered later between media and the action bar */}

      {/* Collapsible Media Tools Panel (between media and action bar) */}
      {canShowMediaTools && showMediaTools && (
        <div id={`media-tools-${id}`} className="mt-1.5">
          <div className="mx-3 sm:mx-5 max-w-full">
            {/* Unified container with tabs on top and compact content below */}
            <div className="my-2 rounded-xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
              {/* Tabs header */}
              <div className="flex w-full items-stretch text-[12px] text-gray-600 border-b border-gray-200">
                <button
                  type="button"
                  className={`flex-1 py-2 text-center transition-colors focus:outline-none ${activeMediaTab === 'transcript' ? 'text-gray-900 font-medium bg-white/40' : 'hover:text-gray-900'}`}
                  onClick={() => setActiveMediaTab(t => (t === 'transcript' ? null : 'transcript'))}
                  aria-pressed={activeMediaTab === 'transcript'}
                >
                  Transcript
                </button>
                <span className="w-px bg-gray-200" aria-hidden />
                <button
                  type="button"
                  className={`flex-1 py-2 text-center transition-colors focus:outline-none ${activeMediaTab === 'translate' ? 'text-gray-900 font-medium bg-white/40' : 'hover:text-gray-900'}`}
                  onClick={() => setActiveMediaTab(t => (t === 'translate' ? null : 'translate'))}
                  aria-pressed={activeMediaTab === 'translate'}
                >
                  Translate
                </button>
              </div>

              {/* Content body */}
              {activeMediaTab && (
                <div className="px-4 py-3">
                  {activeMediaTab === 'transcript' && (
                    <div>
                      <div className="relative">
                        <div
                          ref={transcriptRef}
                          className={`text-[13px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words ${!isTranscriptExpanded ? 'pr-1' : ''}`}
                          style={!isTranscriptExpanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any : undefined}
                        >
                          {audioTranscription || (transcriptionStatus ? `Transcription: ${transcriptionStatus}` : 'No transcript available.')}
                        </div>
                        {!isTranscriptExpanded && (
                          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-white/80" aria-hidden />
                        )}
                      </div>
                      <div className="mt-1 flex justify-center">
                        <button
                          type="button"
                          className="text-[12px] text-gray-600 hover:text-gray-900 underline underline-offset-2 decoration-gray-300"
                          onClick={() => setIsTranscriptExpanded(v => !v)}
                        >
                          {isTranscriptExpanded ? 'Collapse' : 'Expand'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeMediaTab === 'translate' && (
                    <div className="flex items-center justify-between gap-3 text-[13px] text-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Language</span>
                        <select className="text-[13px] border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200">
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                          <option value="zh">Chinese</option>
                        </select>
                      </div>
                      <span className="text-[12px] text-gray-500">Coming soon</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modern Action Bar (match width of white content overlay) */}
      <div className={`mt-0 pb-3 ${gradientFromColor && gradientToColor ? '' : ''}`}>
          <div className="bg-white/95 backdrop-blur-sm border border-white/40 rounded-xl px-3 sm:px-4 py-2.5 shadow-md mx-3 sm:mx-5 max-w-full overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Left: Engagement Actions */}
          <div className="flex items-center gap-6">
            {/* Like Button with Count */}
            <button 
              type="button" 
              className="flex items-center gap-2 group transition-all duration-200 hover:bg-red-50 rounded-full px-3 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-300"
              onClick={() => setSelectedFace(selectedFace === 2 ? null : 2)}
              aria-label="Like"
            >
              <div className={`transition-all duration-200 ${selectedFace === 2 ? 'text-red-500 scale-110' : 'text-gray-600 group-hover:text-red-500'}`}>
                <svg className="w-5 h-5" fill={selectedFace === 2 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className={`text-sm font-medium transition-colors ${selectedFace === 2 ? 'text-red-500' : 'text-gray-700 group-hover:text-red-500'}`}>
                {stats.likes.toLocaleString()}
              </span>
            </button>

            {/* Comment Button with Count */}
            <button 
              type="button" 
              className="flex items-center gap-2 group transition-all duration-200 hover:bg-blue-50 rounded-full px-3 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-300"
              aria-label="Comment"
            >
              <ChatBubbleLeftIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-500 transition-colors" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-500 transition-colors">
                {stats.comments.toLocaleString()}
              </span>
            </button>

            {/* Repost Button with Count */}
            <button 
              type="button" 
              className="flex items-center gap-2 group transition-all duration-200 hover:bg-green-50 rounded-full px-3 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-300"
              aria-label="Repost"
            >
              <svg className="w-5 h-5 text-gray-600 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-sm font-medium text-gray-700 group-hover:text-green-500 transition-colors">
                {stats.reposts.toLocaleString()}
              </span>
            </button>
          </div>

          {/* Right: Secondary Actions */}
          <div className="flex items-center gap-3">
            {canShowMediaTools && (
              <button
                type="button"
                className={`group transition-all duration-200 rounded-full p-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300 ${showMediaTools ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
                onClick={() => {
                  const next = !showMediaTools;
                  setShowMediaTools(next);
                  if (next && !activeMediaTab) setActiveMediaTab('transcript');
                }}
                aria-label="Toggle transcript and translate panel"
                aria-expanded={showMediaTools}
                aria-controls={`media-tools-${id}`}
                title="Transcript / Translate"
              >
                <DocumentTextIcon className={`w-5 h-5 ${showMediaTools ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'}`} />
              </button>
            )}
            {/* Views Count */}
            <div className="flex items-center gap-1.5 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-xs font-medium">{stats.views.toLocaleString()}</span>
            </div>

            {/* Share Button */}
            <button 
              type="button" 
              className="group transition-all duration-200 hover:bg-gray-100 rounded-full p-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300"
              aria-label="Share"
            >
              <ShareIcon className="w-5 h-5 text-gray-700 group-hover:text-gray-900 transition-colors" />
            </button>

            {/* Bookmark Button */}
            <button 
              type="button" 
              className="group transition-all duration-200 hover:bg-gray-100 rounded-full p-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300"
              aria-label="Bookmark"
            >
              <BookmarkIcon className="w-5 h-5 text-gray-700 group-hover:text-gray-900 transition-colors" />
            </button>
          </div>
        </div>
        </div>
      </div>
      </div>
      {/* Close card content container and outer relative gradient container */}
      </div>
      </div>
      
    
      {/* Media Modal */}
      {showMediaModal && (normalizedImageUrls.length > 0 || gifUrl) && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4">
        <div className="relative max-w-4xl max-h-full w-full h-full flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setShowMediaModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Image/GIF */}
          <img 
            src={gifUrl || normalizedImageUrls?.[selectedMediaIndex] || ''} 
            alt={gifUrl ? 'GIF' : `Post image ${selectedMediaIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          
          {/* Navigation arrows for multiple images */}
          {(normalizedImageUrls?.length ?? 0) > 1 && (
            <div>
              <button
                onClick={() => setSelectedMediaIndex(prev => prev > 0 ? prev - 1 : (normalizedImageUrls?.length || 1) - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setSelectedMediaIndex(prev => prev < (normalizedImageUrls?.length || 1) - 1 ? prev + 1 : 0)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
                {selectedMediaIndex + 1} / {normalizedImageUrls?.length || 0}
              </div>
            </div>
          )}
        </div>
        </div>
      )}
  </>
);
}
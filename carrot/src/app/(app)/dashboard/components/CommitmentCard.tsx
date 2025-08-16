"use client";

import { 
  ChatBubbleOvalLeftIcon as ChatBubbleLeftIcon, 
  ArrowPathRoundedSquareIcon, 
  HeartIcon,
  BookmarkIcon, 
  ShareIcon, 
  EllipsisHorizontalIcon,
  ChartBarIcon,
  MapPinIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  TrashIcon,
  NoSymbolIcon,
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
import AudioPlayer from '../../../../components/AudioPlayer';
import { SadFaceIcon, NeutralFaceIcon, HappyFaceIcon } from './FaceIcons';
import Toast from './Toast';
import VideoPlayer from './VideoPlayer';
import QRWaveVisualizer from '../../../../components/QRWaveVisualizer';

// Helper function to get relative time (e.g., "2m ago", "1h ago")
function getRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const postTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - postTime.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}
// Client-only renderer to avoid SSR hydration mismatch for relative times
function TimeAgo({ timestamp }: { timestamp: string | Date }) {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    setText(getRelativeTime(timestamp));
    const id = setInterval(() => setText(getRelativeTime(timestamp)), 30_000);
    return () => clearInterval(id);
  }, [timestamp]);
  return <>{text || '\u00A0'}</>; // nbsp on SSR to keep structure stable
}
// Testing regular import instead of dynamic import to isolate SSR/hydration issues

// Smart Media Display Component
interface SmartMediaDisplayProps {
  src: string;
  alt: string;
  index: number;
  isGrid?: boolean;
  gridHeight?: string;
  isGif?: boolean;
  onExpand: () => void;
}

function SmartMediaDisplay({ src, alt, index, isGrid = false, gridHeight, isGif = false, onExpand }: SmartMediaDisplayProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isCropped, setIsCropped] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalHeight / img.naturalWidth;
    setAspectRatio(ratio);
    setImageLoaded(true);
    
    // Determine if image needs cropping based on aspect ratio buckets
    if (ratio > 1.25) {
      // Tall images (h/w > 1.25) → crop to 4:5 preview
      setIsCropped(true);
    }
  };

  const getContainerStyle = () => {
    if (isGrid) {
      return gridHeight || 'h-48';
    }
    
    if (!aspectRatio) {
      return 'h-96'; // Loading state
    }
    
    // Apply aspect ratio buckets with more generous sizing
    if (aspectRatio <= 1.0) {
      // Landscape: natural up to 16:9, cap height
      const maxHeight = Math.min(560, typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.7) : 560);
      return { maxHeight: `${maxHeight}px` };
    } else if (aspectRatio <= 1.25) {
      // Portrait (≤ 4:5): natural with cap
      const maxHeight = Math.min(560, typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.7) : 560);
      return { maxHeight: `${maxHeight}px` };
    } else {
      // Tall: crop/letterbox to 4:5 preview
      return 'aspect-[4/5] max-h-[560px]';
    }
  };

  const containerStyle = getContainerStyle();
  const isStyleObject = typeof containerStyle === 'object';

  return (
    <div 
      className={`relative w-full max-w-full min-w-0 rounded-2xl overflow-hidden bg-transparent cursor-pointer group ${
        isStyleObject ? '' : containerStyle
      }`}
      style={isStyleObject ? containerStyle : undefined}
      onClick={onExpand}
    >
      <img 
        src={src} 
        alt={alt}
        className={`w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 ${
          isCropped ? 'object-center' : ''
        }`}
        onLoad={handleImageLoad}
        onError={(e) => {
          console.error('❌ Image failed to load:', src);
          e.currentTarget.style.display = 'none';
        }}
      />
      
      {/* Expand button (cropped items only) */}
      {isCropped && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button 
            className="bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      )}

      {/* Cropped indicator pill */}
      {isCropped && imageLoaded && (
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
            Cropped • Tap to expand
          </div>
        </div>
      )}
      
      {/* GIF Badge */}
      {isGif && (
        <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm">
          GIF
        </div>
      )}
    </div>
  );
}



export type VoteType = 'carrot' | 'stick' | null;

export type Stats = {
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  // Legacy fields for backward compatibility
  carrots?: number;
  sticks?: number;
};

export interface CommitmentCardProps {
  id: string;
  content: string;
  carrotText: string;
  stickText: string;
  author: {
    name: string;
    username: string;
    avatar?: string | null;
    flag?: string;
    id?: string; // Add author ID for ownership comparison
  };
  location: {
    zip: string;
    city?: string;
    state?: string;
  };
  stats: Stats;
  userVote?: VoteType;
  onVote?: (id: string, vote: VoteType) => void;
  onDelete?: (id: string) => void; // Callback for post deletion
  onBlock?: (id: string) => void; // Callback for post blocking
  timestamp?: string;
  innerBoxColor?: string;
  imageUrls?: string[];
  gifUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  videoThumbnail?: string; // Support for video thumbnail from CommitmentComposer
  videoTranscriptionStatus?: string; // Support for video transcription status
  audioUrl?: string;
  audioDurationSeconds?: number; // Optional hint to show duration immediately
  audioTranscription?: string;
  transcriptionStatus?: string;
  emoji?: string;
  gradientFromColor?: string;
  gradientToColor?: string;
  gradientViaColor?: string;
  gradientDirection?: string;
  uploadStatus?: 'uploading' | 'uploaded' | 'processing' | 'ready' | null;
  uploadProgress?: number;
  // ID of the currently logged-in user (used to determine ownership of the post)
  currentUserId?: string;
}



export default function CommitmentCard({
  id,
  content,
  carrotText,
  stickText,
  author,
  location,
  stats,
  userVote = null,
  onVote,
  onDelete,
  onBlock,
  innerBoxColor,
  timestamp,
  imageUrls,
  gifUrl,
  videoUrl,
  thumbnailUrl,
  videoThumbnail,
  videoTranscriptionStatus,
  audioUrl,
  audioDurationSeconds,
  audioTranscription,
  transcriptionStatus,
  emoji,
  gradientFromColor,
  gradientToColor,
  gradientViaColor,
  gradientDirection,
  uploadStatus,
  uploadProgress,
  currentUserId,
}: CommitmentCardProps) {
  // Convert ISO country code (e.g., 'US') to flag emoji. If already emoji, return as-is.
  const getFlagEmoji = (code?: string) => {
    if (!code) return '';
    const trimmed = code.trim();
    // If contains unicode surrogate pair for flags or non A-Z letters, return as-is
    if (/[\uD83C][\uDDE6-\uDDFF]/.test(trimmed) || /[^a-zA-Z]/.test(trimmed) && trimmed.length > 2) {
      return trimmed;
    }
    const upper = trimmed.toUpperCase();
    if (upper.length !== 2 || /[^A-Z]/.test(upper)) return trimmed; // fallback
    const base = 0x1F1E6; // Regional Indicator Symbol Letter A
    const first = base + (upper.charCodeAt(0) - 65);
    const second = base + (upper.charCodeAt(1) - 65);
    return String.fromCodePoint(first) + String.fromCodePoint(second);
  };
  // Build Twemoji URL for a flag given a 2-letter code or an emoji flag (with overrides)
  const getFlagTwemojiUrl = (codeOrEmoji?: string) => {
    if (!codeOrEmoji) return '';
    const effective = getCountryCode(codeOrEmoji); // applies overrides (e.g., il -> ps)
    const toHex = (cp: number) => cp.toString(16);
    const cps: number[] = [];
    if (effective) {
      const upper = effective.toUpperCase();
      const base = 0x1F1E6;
      cps.push(base + (upper.charCodeAt(0) - 65));
      cps.push(base + (upper.charCodeAt(1) - 65));
    } else {
      // Fallback: derive from emoji as-is
      const s = codeOrEmoji.trim();
      for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (!cp) continue;
        if (cp >= 0x1F1E6 && cp <= 0x1F1FF) cps.push(cp);
      }
    }
    if (cps.length !== 2) return '';
    const file = cps.map(toHex).join('-');
    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${file}.svg`;
  };
  // Country overrides: map IL -> PS (render Palestine flag for Israel code)
  const applyCountryOverrides = (codeLower: string) => {
    const map: Record<string, string> = {
      il: 'ps',
    };
    return map[codeLower] || codeLower;
  };

  // Get 2-letter ISO code from code or emoji flag (e.g., 'US' or '🇺🇸' -> 'us'), with overrides applied
  const getCountryCode = (codeOrEmoji?: string) => {
    if (!codeOrEmoji) return '';
    const s = codeOrEmoji.trim();
    if (/^[a-zA-Z]{2}$/.test(s)) return applyCountryOverrides(s.toLowerCase());
    const cps: number[] = [];
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (!cp) continue;
      if (cp >= 0x1F1E6 && cp <= 0x1F1FF) cps.push(cp);
    }
    if (cps.length !== 2) return '';
    const A = 0x1F1E6;
    const first = String.fromCharCode(65 + (cps[0] - A));
    const second = String.fromCharCode(65 + (cps[1] - A));
    return applyCountryOverrides((first + second).toLowerCase());
  };
  const getLocalFlagUrl = (codeOrEmoji?: string) => {
    const cc = getCountryCode(codeOrEmoji);
    return cc ? `/flags/${cc}.svg` : '';
  };
  // Format location string for tooltip
  const getLocationString = () => {
    if (!location) return '';
    if (location.city) return `${location.city}${location.state ? ', ' + location.state : ''}`;
    return location.state || location.zip || '';
  };
  const [selectedFace, setSelectedFace] = useState<null | 0 | 1 | 2>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [flagLocalFailed, setFlagLocalFailed] = useState(false);
  const [flagCdnFailed, setFlagCdnFailed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaAspectRatios, setMediaAspectRatios] = useState<number[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); // 0..1 normalized
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showToast, setShowToast] = useState<boolean>(false);
  // Media tabs: Transcript / Translate
  const [activeMediaTab, setActiveMediaTab] = useState<null | 'transcript' | 'translate'>(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [showMediaTools, setShowMediaTools] = useState(false);
  
  // Ownership is determined via currentUserId passed from parent

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  // Measure if content overflows 3-line clamp
  useEffect(() => {
    const checkOverflow = () => {
      const el = contentRef.current;
      if (!el) return;
      // Temporarily ensure clamp is applied for measurement when collapsed
      const prevDisplay = el.style.display;
      const prevOrient = (el.style as any).WebkitBoxOrient;
      const prevClamp = (el.style as any).WebkitLineClamp;
      const prevOverflow = el.style.overflow;
      if (!isExpanded) {
        el.style.display = '-webkit-box';
        (el.style as any).WebkitBoxOrient = 'vertical';
        (el.style as any).WebkitLineClamp = '3';
        el.style.overflow = 'hidden';
      }
      // Use rAF to read after style change
      requestAnimationFrame(() => {
        const overflowing = el.scrollHeight > el.clientHeight + 1;
        setIsOverflowing(overflowing);
        // Restore inline styles to avoid persisting measurement state
        el.style.display = prevDisplay;
        (el.style as any).WebkitBoxOrient = prevOrient as any;
        (el.style as any).WebkitLineClamp = prevClamp as any;
        el.style.overflow = prevOverflow;
      });
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [content, isExpanded]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Initialize state with proper fallbacks
  const [currentVote, setCurrentVote] = useState<VoteType>(userVote || null);
  const [carrotCount, setCarrotCount] = useState(stats?.carrots || 0);
  const [stickCount, setStickCount] = useState(stats?.sticks || 0);
  const [commentCount, setCommentCount] = useState(stats?.comments || 0);
  const [repostCount, setRepostCount] = useState(stats?.reposts || 0);
  const viewCount = stats?.views || 0;
  
  // Create gradient style with proper direction mapping
  const getGradientDirection = (direction?: string) => {
    const directionMap: { [key: string]: string } = {
      'to-t': 'to top',
      'to-tr': 'to top right', 
      'to-r': 'to right',
      'to-br': 'to bottom right',
      'to-b': 'to bottom',
      'to-bl': 'to bottom left',
      'to-l': 'to left',
      'to-tl': 'to top left',
    };
    return directionMap[direction || ''] || direction || '135deg';
  };

  const gradientStyle = gradientFromColor && gradientToColor ? {
    background: gradientViaColor 
      ? `linear-gradient(${getGradientDirection(gradientDirection)}, ${gradientFromColor}, ${gradientViaColor}, ${gradientToColor})`
      : `linear-gradient(${getGradientDirection(gradientDirection)}, ${gradientFromColor}, ${gradientToColor})`
  } : innerBoxColor ? { backgroundColor: innerBoxColor } : {};

  // Format timestamp for display
  let formattedTimestamp = '2h';
  if (timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) formattedTimestamp = `${diff}s`;
    else if (diff < 3600) formattedTimestamp = `${Math.floor(diff/60)}m`;
    else if (diff < 86400) formattedTimestamp = `${Math.floor(diff/3600)}h`;
    else formattedTimestamp = `${Math.floor(diff/86400)}d`;
  }

  // Determine if this post belongs to the current user
  const isCurrentUserPost = Boolean(currentUserId && author?.id && currentUserId === author.id);
  
  // Debug ownership detection (disabled for testing)
  // console.log('🔍 Post ownership check:', {
  //   sessionUserId: (session?.user as any)?.id,
  //   authorId: author?.id,
  //   isCurrentUserPost,
  //   authorUsername: author?.username,
  //   sessionUsername: (session?.user as any)?.username
  // });

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);
  
  // Handle vote for carrot or stick
  const handleVote = (type: VoteType) => {
    const isNewVote = currentVote !== type;
    const newVote = isNewVote ? type : null;
    
    // Update counts based on the vote type and previous state
    if (type === 'carrot') {
      if (currentVote === 'carrot') {
        // Toggling off carrot
        setCarrotCount(Math.max(0, carrotCount - 1));
      } else if (currentVote === 'stick') {
        // Switching from stick to carrot
        setStickCount(Math.max(0, stickCount - 1));
        setCarrotCount(carrotCount + 1);
      } else {
        // New carrot vote
        setCarrotCount(carrotCount + 1);
      }
    } else if (type === 'stick') {
      if (currentVote === 'stick') {
        // Toggling off stick
        setStickCount(Math.max(0, stickCount - 1));
      } else if (currentVote === 'carrot') {
        // Switching from carrot to stick
        setCarrotCount(Math.max(0, carrotCount - 1));
        setStickCount(stickCount + 1);
      } else {
        // New stick vote
        setStickCount(stickCount + 1);
      }
    }
    
    setCurrentVote(newVote);
    
    if (onVote) {
      onVote(id, newVote);
    }
  };

  const toggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setRepostCount(isReposted ? repostCount - 1 : repostCount + 1);
  };

  const handleDeletePost = async () => {
    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Call parent callback to remove from UI
        if (onDelete) {
          onDelete(id);
        }
        setShowDeleteConfirm(false);
        setShowDropdown(false);
      } else {
        const errorText = await response.text();
        console.error('Failed to delete post:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleBlockPost = () => {
    // Show notification first
    setToastMessage('Content blocked and hidden from your feed');
    setToastType('info');
    setShowToast(true);
    
    // Call parent callback to hide from UI after a brief delay
    setTimeout(() => {
      if (onBlock) {
        onBlock(id);
      }
    }, 1000);
    
    setShowDropdown(false);
  };

  const hideToast = () => {
    setShowToast(false);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Use innerBoxColor and flag props directly
  const customInnerBoxColor = innerBoxColor || 'bg-gray-100';
  const flag = author?.flag || '';
  const time = timestamp || formattedTimestamp;

  // (Removed unused cardGradientStyle)

  // Calculate text color for contrast
  const isLightBg = customInnerBoxColor.includes('yellow') || customInnerBoxColor.includes('lime') || customInnerBoxColor.includes('pink') || customInnerBoxColor.includes('gray-100') || customInnerBoxColor.includes('white');
  const textColor = isLightBg ? 'text-gray-900' : 'text-white';
  const hasMedia = Boolean((imageUrls && imageUrls.length > 0) || gifUrl || videoUrl);
  // Show transcript/translate tools if any relevant media or transcription exists
  const canShowMediaTools = Boolean(
    videoUrl ||
    audioUrl ||
    audioTranscription ||
    transcriptionStatus ||
    videoTranscriptionStatus
  );

  return (
    <>
      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={hideToast}
      />
      
      {/* Full-width gradient background container */}
      <div className="relative">
        {/* Gradient background that extends full width */}
        {gradientFromColor && gradientToColor && (
          <div 
            className="absolute inset-0 -mx-6 rounded-2xl"
            style={gradientStyle}
          />
        )}
        
        {/* Card content container */}
        <div className={`relative rounded-2xl flex flex-col gap-3 ${gradientFromColor && gradientToColor ? '' : 'bg-white p-4'}`} style={{ boxShadow: 'none' }}>
      
      {/* Content Box - single gradient behind; overlay only here (no inner gradient) */}
      <div className="-mx-6 px-[1px]">
        <div 
          className={`relative transition-colors min-h-[56px] mb-0 overflow-visible ${hasMedia ? 'rounded-t-xl rounded-b-md pb-3 pt-4' : 'rounded-xl py-4'}`}
        >
        {/* White content overlay with enhanced styling */}
        <div className={`bg-white/95 backdrop-blur-sm shadow-md border border-white/40 mx-5 ${hasMedia ? 'rounded-t-xl rounded-b-md border-b-0' : 'rounded-xl'}`}>
          <div className="p-5 space-y-4">
            {/* Header inside overlay */}
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {author?.avatar ? (
                    <Image 
                      src={author.avatar} 
                      alt={author?.name || 'User'}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-500 text-base font-bold">
                      {author?.name ? author.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {author?.flag && (() => {
                    const localUrl = getLocalFlagUrl(author.flag);
                    const cdnUrl = getFlagTwemojiUrl(author.flag);
                    if (localUrl && !flagLocalFailed) {
                      return (
                        <img
                          src={localUrl}
                          alt="Country flag"
                          title={getLocationString() || author.flag}
                          className="h-[18px] w-[18px] flex-shrink-0"
                          loading="lazy"
                          onError={() => setFlagLocalFailed(true)}
                        />
                      );
                    }
                    if (cdnUrl && !flagCdnFailed) {
                      return (
                        <img
                          src={cdnUrl}
                          alt="Country flag"
                          title={getLocationString() || author.flag}
                          className="h-[18px] w-[18px] flex-shrink-0"
                          loading="lazy"
                          onError={() => setFlagCdnFailed(true)}
                        />
                      );
                    }
                    return (
                      <span
                        className="text-xl leading-none flex-shrink-0"
                        style={{ fontFamily: 'Segoe UI Emoji, Noto Color Emoji, Apple Color Emoji, Twemoji Mozilla, EmojiOne Color, Android Emoji, system-ui, sans-serif' }}
                        title={getLocationString() || author.flag}
                        aria-label="Country"
                        role="img"
                      >
                        {getFlagEmoji(author.flag)}
                      </span>
                    );
                  })()}
                  <span className="font-semibold text-[15px] text-gray-900 truncate">
                    {author?.username ? (author.username.startsWith('@') ? author.username : `@${author.username}`) : '@unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Link href={`/post/${id}`} className="hover:text-gray-700 hover:underline">
                    <TimeAgo timestamp={timestamp || new Date().toISOString()} />
                  </Link>
                  {!author?.flag && (location?.city || location?.state || location?.zip) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      <MapPinIcon className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[140px]">
                        {location?.city ? `${location.city}${location?.state ? ", " + location.state : ''}` : (location?.state || location?.zip || '')}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {/* Follow + Options */}
              <div className="flex items-start gap-2">
                {mounted && !isCurrentUserPost && (
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-300 ${isFollowing ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' : 'bg-white text-orange-500 border-orange-400 hover:bg-orange-50'}`}
                    onClick={() => setIsFollowing(f => !f)}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    type="button" 
                    className="p-1 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300 rounded"
                    onClick={toggleDropdown}
                    aria-label="Post options"
                  >
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </button>
                  {showDropdown && (
                    <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      {isCurrentUserPost ? (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={handleBlockPost}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <NoSymbolIcon className="h-4 w-4" />
                          Block This Content
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Enhanced content text with better typography */}
            <div className="relative">
              <div
                ref={contentRef}
                className={`text-gray-900 leading-relaxed whitespace-pre-wrap break-words text-[15px] ${!isExpanded ? 'pr-1' : ''}`}
                style={
                  !isExpanded
                    ? ({
                        display: '-webkit-box',
                        WebkitLineClamp: 3 as any,
                        WebkitBoxOrient: 'vertical' as any,
                        overflow: 'hidden',
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {content}
              </div>
              {!isExpanded && isOverflowing && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-white/95 rounded-b-md" aria-hidden />
              )}
            </div>
            {(isOverflowing || isExpanded) && (
              <div className="flex justify-center">
                <button
                  className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded-md px-3 py-1 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onClick={() => setIsExpanded((v) => !v)}
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
            )}
            {/* Note: Video moved outside overlay so gradient shows behind */}
            </div>
      </div>
      </div>
      {/* end overlay wrapper */}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Post</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media outside white overlay, full gradient width with 1px gutter */}
      {imageUrls && imageUrls.length > 0 && (
        <div className="-mt-[6px] mx-0 px-0 sm:-mx-6 sm:px-[1px] overflow-hidden rounded-b-2xl max-w-full min-w-0">
          <SmartMediaDisplay
            src={imageUrls[0]}
            alt="Post image"
            index={0}
            onExpand={() => {
              setSelectedMediaIndex(0);
              setShowMediaModal(true);
            }}
          />
        </div>
      )}
      {gifUrl && (
        <div className="-mt-[6px] mx-0 px-0 sm:-mx-6 sm:px-[1px] overflow-hidden rounded-b-2xl max-w-full min-w-0">
          <SmartMediaDisplay
            src={gifUrl}
            alt="Post GIF"
            index={0}
            isGif
            onExpand={() => {
              setSelectedMediaIndex(0);
              setShowMediaModal(true);
            }}
          />
        </div>
      )}
      {audioUrl && (
        <div className="my-2 mx-3 sm:mx-5 flex justify-center max-w-full min-w-0">
          <div className="relative w-full max-w-full sm:max-w-[560px] bg-white/95 backdrop-blur-sm border border-white/40 shadow-md rounded-2xl p-4">
            {/* Unified QR-wave visual container with centered overlay only */}
            <div className="flex flex-col items-center">
              {/* Visualizer with centered overlay */}
              <div className="relative" style={{ width: 280, height: 280 }}>
                {/* Canvas layer */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <QRWaveVisualizer size={280} grid={32} playing={isAudioPlaying} intensity={0.75} progress={audioProgress} avatarUrl={author?.avatar || undefined} />
                </div>
                {/* Center overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`px-3 py-1.5 rounded-full bg-white/55 backdrop-blur-[2px] shadow-sm border border-white/50 ${isAudioPlaying ? 'animate-[pulse_2.2s_ease-in-out_infinite]' : ''}`}>
                    <span className="font-semibold text-[13px] text-gray-900">
                      {author?.username ? (author.username.startsWith('@') ? author.username : `@${author.username}`) : '@unknown'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 w-full">
                <AudioPlayer
                  audioUrl={audioUrl}
                  postId={id}
                  initialDurationSeconds={typeof audioDurationSeconds === 'number' ? audioDurationSeconds : undefined}
                  className="!bg-transparent !shadow-none !p-0"
                  showWaveform={false}
                  onPlayStateChange={(p) => setIsAudioPlaying(p)}
                  onTimeUpdate={(ct, dur) => {
                    if (dur && isFinite(dur) && dur > 0) {
                      const p = Math.max(0, Math.min(1, ct / dur));
                      setAudioProgress(p);
                    } else {
                      setAudioProgress(0);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="-mt-[6px] mx-0 px-0 sm:-mx-6 sm:px-[1px] overflow-hidden rounded-b-2xl flex justify-center max-w-full min-w-0">
          <div className="relative rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5 bg-transparent w-full max-w-full sm:max-w-[550px] mx-auto min-w-0">
            <VideoPlayer
              videoUrl={videoUrl}
              thumbnailUrl={thumbnailUrl || videoThumbnail}
              postId={id}
              initialTranscription={audioTranscription}
              transcriptionStatus={videoTranscriptionStatus || transcriptionStatus}
              uploadStatus={uploadStatus || null}
              uploadProgress={uploadProgress || 0}
            />
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
      {showMediaModal && (imageUrls || gifUrl) && (
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
            src={gifUrl || imageUrls?.[selectedMediaIndex] || ''} 
            alt={gifUrl ? 'GIF' : `Post image ${selectedMediaIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          
          {/* Navigation arrows for multiple images */}
          {(imageUrls?.length ?? 0) > 1 && (
            <div>
              <button
                onClick={() => setSelectedMediaIndex(prev => prev > 0 ? prev - 1 : (imageUrls?.length || 1) - 1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setSelectedMediaIndex(prev => prev < (imageUrls?.length || 1) - 1 ? prev + 1 : 0)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
                {selectedMediaIndex + 1} / {imageUrls?.length || 0}
              </div>
            </div>
          )}
        </div>
        </div>
      )}
  </>
);
}
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
  NoSymbolIcon
} from '@heroicons/react/24/outline';
import { 
  HeartIcon as HeartIconSolid,
  BookmarkIcon as BookmarkIconSolid,
  CheckBadgeIcon,
  HandThumbUpIcon as HandThumbUpIconSolid,
  HandThumbDownIcon as HandThumbDownIconSolid
} from '@heroicons/react/24/solid';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import AudioPlayer from '../../../../components/AudioPlayer';
import { SadFaceIcon, NeutralFaceIcon, HappyFaceIcon } from './FaceIcons';
import Toast from './Toast';

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

import VideoPlayer from './VideoPlayer';
// Testing regular import instead of dynamic import to isolate SSR/hydration issues



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
  audioUrl?: string;
  audioTranscription?: string;
  transcriptionStatus?: string;
  emoji?: string;
  gradientFromColor?: string;
  gradientToColor?: string;
  gradientViaColor?: string;
  gradientDirection?: string;
  uploadStatus?: 'uploading' | 'uploaded' | 'processing' | 'ready' | null;
  uploadProgress?: number;
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
  audioUrl,
  audioTranscription,
  transcriptionStatus,
  emoji,
  gradientFromColor,
  gradientToColor,
  gradientViaColor,
  gradientDirection,
  uploadStatus,
  uploadProgress,
}: CommitmentCardProps) {
  const [selectedFace, setSelectedFace] = useState<null | 0 | 1 | 2>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongContent = content.split('\n').length > 4;

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [showToast, setShowToast] = useState<boolean>(false);
  
  // Get current user session
  const { data: session } = useSession();
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Initialize state with proper fallbacks
  const [currentVote, setCurrentVote] = useState<VoteType>(userVote || null);
  const [carrotCount, setCarrotCount] = useState(stats?.carrots || 0);
  const [stickCount, setStickCount] = useState(stats?.sticks || 0);
  const [commentCount, setCommentCount] = useState(stats?.comments || 0);
  const [repostCount, setRepostCount] = useState(stats?.reposts || 0);
  const viewCount = stats?.views || 0;
  
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

  // Gradient background from DB fields - using inline styles instead of dynamic Tailwind classes
  const gradientStyle = (gradientFromColor && gradientToColor) ? {
    background: gradientViaColor 
      ? `linear-gradient(to bottom right, ${gradientFromColor}, ${gradientViaColor}, ${gradientToColor})`
      : `linear-gradient(to bottom right, ${gradientFromColor}, ${gradientToColor})`
  } : {};

  // Check if current user is the post owner
  const isCurrentUserPost = session?.user?.id === author.id;
  
  // Debug ownership detection
  console.log('🔍 Post ownership check:', {
    sessionUserId: session?.user?.id,
    authorId: author.id,
    isCurrentUserPost,
    authorUsername: author.username,
    sessionUsername: session?.user?.username
  });

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
  const flag = author.flag || '';
  const time = timestamp || formattedTimestamp;

  // Create gradient style from props
  const cardGradientStyle = gradientFromColor && gradientToColor ? {
    background: `linear-gradient(${gradientDirection || 'to-br'}, ${gradientFromColor}${gradientViaColor ? `, ${gradientViaColor}` : ''}, ${gradientToColor})`
  } : {};

  // Calculate text color for contrast
  const isLightBg = customInnerBoxColor.includes('yellow') || customInnerBoxColor.includes('lime') || customInnerBoxColor.includes('pink') || customInnerBoxColor.includes('gray-100') || customInnerBoxColor.includes('white');
  const textColor = isLightBg ? 'text-gray-900' : 'text-white';

  return (
    <>
      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={hideToast}
      />
      
      <div className={`rounded-2xl p-4 flex flex-col gap-3 ${gradientFromColor && gradientToColor ? '' : 'bg-white'}`} style={{ boxShadow: 'none', ...cardGradientStyle }}>
      {/* Header Row */}
      <div className="flex items-center gap-3 text-black">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {author.avatar ? (
              <Image 
                src={author.avatar} 
                alt={author.name}
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-gray-500 text-base font-bold">
                {author.name ? author.name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[15px] text-gray-900">{author.username ? (author.username.startsWith('@') ? author.username : `@${author.username}`) : '@unknown'}</span>
            {flag && <span className="text-lg leading-none">{flag}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href={`/post/${id}`}
              className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
            >
              {getRelativeTime(timestamp || new Date().toISOString())}
            </Link>
          </div>
        </div>
        {/* Follow/Following Button - Only show for other users' posts */}
        {!isCurrentUserPost && (
          <button
            type="button"
            className={`ml-auto px-3 py-1 text-xs font-semibold rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-200 mr-2 ${isFollowing ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' : 'bg-white text-orange-500 border-orange-400 hover:bg-orange-50'}`}
            onClick={() => setIsFollowing(f => !f)}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
        {/* Options */}
        <div className="relative" ref={dropdownRef}>
          <button 
            type="button" 
            className="p-1 text-gray-400 hover:text-gray-600"
            onClick={toggleDropdown}
          >
            <EllipsisHorizontalIcon className="h-5 w-5" />
          </button>
          
          {/* Dropdown Menu */}
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

      {/* Content Box - colored background with white overlay box-in-box */}
      <div 
        className="relative rounded-xl px-5 py-4 transition-colors min-h-[56px] mb-1 overflow-visible"
        style={gradientStyle}
      >
        {/* White overlay as an inner box */}
        <div className="relative z-10 mx-2 my-2 md:mx-4 md:my-3">
          <div className="rounded-xl bg-white/50 px-6 py-5 text-black relative">

            <div className={`text-base font-medium leading-snug break-words whitespace-pre-line text-black ${!isExpanded && isLongContent ? 'line-clamp-4' : ''}`}>{content}</div>
            {isLongContent && !isExpanded && (
              <div className="flex justify-center mt-2">
                <button
                  className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded-md px-3 py-1 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onClick={() => setIsExpanded(true)}
                >
                  See more
                </button>
              </div>
            )}
            {/* Emoji - Removed per user request */}
            {/* Image Display */}
          {imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0 && typeof imageUrls[0] === 'string' && imageUrls[0].trim() && (
              <div className="mt-4 flex justify-center">
                <div className="w-full max-w-[550px] min-w-[320px] mx-4">
                  <div className="relative w-full rounded-lg overflow-hidden bg-gray-100 flex justify-center items-center max-h-[600px] sm:max-h-[400px] md:max-h-[500px] lg:max-h-[600px]" style={{
                    maxHeight: 'min(70vh, 600px)'
                  }}>
                    <Image 
                      src={imageUrls[0]} 
                      alt="Post image" 
                      width={550}
                      height={400}
                      priority
                      className="max-w-full max-h-full object-contain" 
                      style={{ 
                        maxHeight: 'min(70vh, 600px)',
                        width: 'auto',
                        height: 'auto'
                      }}
                      sizes="(max-width: 640px) calc(100vw - 32px), 550px"
                    />
                  </div>
                </div>
              </div>
            )}
            {/* GIF - Centered with Smart Sizing and Height Constraints */}
            {gifUrl && (
              <div className="mt-4 flex justify-center">
                <div className="w-full max-w-[550px] min-w-[320px] mx-4">
                  <div className="relative w-full rounded-lg overflow-hidden bg-gray-100 flex justify-center items-center max-h-[600px] sm:max-h-[400px] md:max-h-[500px] lg:max-h-[600px]" style={{
                    maxHeight: 'min(70vh, 600px)'
                  }}>
                    <img 
                      src={gifUrl} 
                      alt="GIF" 
                      className="max-w-full max-h-full object-contain rounded-lg" 
                      style={{ 
                        maxHeight: 'min(70vh, 600px)',
                        width: 'auto',
                        height: 'auto'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Video - Centered with Smart Sizing */}
            {videoUrl && (
              <div className="mt-4 flex justify-center">
                <div className="w-full max-w-[550px] min-w-[320px] mx-4">
                  <VideoPlayer 
                    videoUrl={videoUrl}
                    thumbnailUrl={thumbnailUrl}
                    postId={id}
                    initialTranscription={audioTranscription}
                    transcriptionStatus={transcriptionStatus}
                    uploadStatus={uploadStatus || null}
                    uploadProgress={uploadProgress || 0}
                  />
                </div>
              </div>
            )}
            {/* Audio */}
            {audioUrl && (
              <div className="mt-4">
                <AudioPlayer 
                  audioUrl={audioUrl}
                  postId={id}
                  initialTranscription={audioTranscription}
                  transcriptionStatus={transcriptionStatus}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Action Bar */}
      <div className="flex items-center justify-between px-0 pt-1 pb-0 w-full" style={{ maxWidth: '100%' }}>
        {/* Left: Face Icons */}
        <div className="flex gap-2 items-center pl-5">
          <button type="button" className="hover:bg-gray-100 rounded-full p-1" onClick={() => setSelectedFace(0)} aria-label="sad">
            <SadFaceIcon selected={selectedFace === 0} />
          </button>
          <button type="button" className="hover:bg-gray-100 rounded-full p-1" onClick={() => setSelectedFace(1)} aria-label="neutral">
            <NeutralFaceIcon selected={selectedFace === 1} />
          </button>
          <button type="button" className="hover:bg-gray-100 rounded-full p-1" onClick={() => setSelectedFace(2)} aria-label="happy">
            <HappyFaceIcon selected={selectedFace === 2} />
          </button>
        </div>
        {/* Right: Other Actions */}
        <div className="flex gap-2 items-center pr-5">
          <button type="button" className="hover:bg-gray-100 rounded-full p-1"><span role="img" aria-label="bump" className="text-xl">👊</span></button>
          <button type="button" className="hover:bg-gray-100 rounded-full p-1"><ChatBubbleLeftIcon className="h-5 w-5 text-gray-400" /></button>
          <button type="button" className="hover:bg-gray-100 rounded-full p-1"><ShareIcon className="h-5 w-5 text-gray-400" /></button>
          <button type="button" className="hover:bg-gray-100 rounded-full p-1"><BookmarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>
      </div>
    </div>
    </>
  );
}

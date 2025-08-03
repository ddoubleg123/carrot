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
  HandThumbDownIcon
} from '@heroicons/react/24/outline';
import { 
  HeartIcon as HeartIconSolid,
  BookmarkIcon as BookmarkIconSolid,
  CheckBadgeIcon,
  HandThumbUpIcon as HandThumbUpIconSolid,
  HandThumbDownIcon as HandThumbDownIconSolid
} from '@heroicons/react/24/solid';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SadFaceIcon, NeutralFaceIcon, HappyFaceIcon } from './FaceIcons';

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
  };
  location: {
    zip: string;
    city?: string;
    state?: string;
  };
  stats: Stats;
  userVote?: VoteType;
  onVote?: (id: string, vote: VoteType) => void;
  timestamp?: string;
  innerBoxColor?: string;
  imageUrls?: string[];
  gifUrl?: string;
  audioUrl?: string;
  emoji?: string;
  gradientFromColor?: string;
  gradientToColor?: string;
  gradientViaColor?: string;
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
  innerBoxColor,
  timestamp,
  imageUrls,
  gifUrl,
  audioUrl,
  emoji,
  gradientFromColor,
  gradientToColor,
  gradientViaColor,
}: CommitmentCardProps) {
  const [selectedFace, setSelectedFace] = useState<null | 0 | 1 | 2>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongContent = content.split('\n').length > 4;

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
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

  // Gradient background from DB fields
  let gradientBg = '';
  if (typeof gradientFromColor === 'string' && typeof gradientToColor === 'string') {
    gradientBg = `bg-gradient-to-br from-[${gradientFromColor}] to-[${gradientToColor}]`;
    if (gradientViaColor) {
      gradientBg = `bg-gradient-to-br from-[${gradientFromColor}] via-[${gradientViaColor}] to-[${gradientToColor}]`;
    }
  }
  
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

  // Calculate text color for contrast
  const isLightBg = customInnerBoxColor.includes('yellow') || customInnerBoxColor.includes('lime') || customInnerBoxColor.includes('pink') || customInnerBoxColor.includes('gray-100') || customInnerBoxColor.includes('white');
  const textColor = isLightBg ? 'text-gray-900' : 'text-white';

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-3" style={{ boxShadow: 'none' }}>
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
                {author.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[15px] text-gray-900 truncate">{author.name}</span>
            {flag && <span className="ml-1 text-lg leading-none">{flag}</span>}
            <span className="text-sm text-gray-500">@{author.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{time} ago</span>
          </div>
        </div>
        {/* Follow/Following Button */}
        <button
          type="button"
          className={`ml-auto px-3 py-1 text-xs font-semibold rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-200 mr-2 ${isFollowing ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' : 'bg-white text-orange-500 border-orange-400 hover:bg-orange-50'}`}
          onClick={() => setIsFollowing(f => !f)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
        {/* Options */}
        <button type="button" className="p-1 text-gray-400 hover:text-gray-600">
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </button>
      </div>
      {/* Content Box - colored background with white overlay box-in-box */}
      <div className={`relative rounded-xl px-5 py-4 ${gradientBg || customInnerBoxColor} ${textColor} transition-colors min-h-[56px] mb-1 overflow-visible`}>
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
            {/* Emoji */}
            {emoji && (
              <div className="mt-3 text-3xl text-center">{emoji}</div>
            )}
            {/* Image Gallery */}
            {Array.isArray(imageUrls) && imageUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {imageUrls.map((url: string, i: number) => (
                  <div key={i} className="relative aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-gray-100">
                    <Image src={url} alt={`Post image ${i+1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
            {/* GIF */}
            {gifUrl && (
              <div className="mt-4 flex justify-center">
                <img src={gifUrl} alt="GIF" className="rounded-xl max-h-64" />
              </div>
            )}
            {/* Audio */}
            {audioUrl && (
              <div className="mt-4 flex justify-center">
                <audio controls src={audioUrl} className="w-full max-w-xs" />
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
  );
}

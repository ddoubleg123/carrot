'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Search, Filter, Clock, ThumbsUp, Reply, MoreHorizontal } from 'lucide-react';

interface Discussion {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  replies: number;
  likes: number;
  isLiked?: boolean;
  isEndingSoon?: boolean;
}

interface Patch {
  id: string;
  name: string;
}

interface DiscussionsViewProps {
  patch: Patch;
}

export default function DiscussionsView({ patch }: DiscussionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'new' | 'top' | 'ending-soon'>('new');
  const [showFilters, setShowFilters] = useState(false);

  // Mock data - in real implementation, this would come from props or API
  const discussions: Discussion[] = [
    {
      id: '1',
      title: 'What would be the ideal term limit structure?',
      content: 'I\'ve been thinking about this a lot lately. Should we have a single 12-year limit, or something more nuanced like 6 years in the House and 12 in the Senate? What do you all think?',
      author: {
        id: '1',
        name: 'Dr. Sarah Chen',
        username: 'sarahchen',
        avatar: '/avatar-placeholder.svg'
      },
      createdAt: new Date('2024-01-15T10:30:00'),
      updatedAt: new Date('2024-01-15T10:30:00'),
      tags: ['policy', 'discussion'],
      replies: 12,
      likes: 8,
      isLiked: false
    },
    {
      id: '2',
      title: 'Historical examples of term limits working well',
      content: 'Looking at state legislatures that have implemented term limits, we can see some interesting patterns. California and Michigan both have experience with this...',
      author: {
        id: '2',
        name: 'John Doe',
        username: 'johndoe',
        avatar: '/avatar-placeholder.svg'
      },
      createdAt: new Date('2024-01-14T15:45:00'),
      updatedAt: new Date('2024-01-14T15:45:00'),
      tags: ['research', 'history'],
      replies: 5,
      likes: 15,
      isLiked: true
    },
    {
      id: '3',
      title: 'Carrot: Term Limits Bill Discussion - Ending Soon!',
      content: 'This is a time-sensitive discussion about the upcoming term limits bill. We need to gather community input before the vote next week.',
      author: {
        id: '3',
        name: 'Jane Smith',
        username: 'janesmith',
        avatar: '/avatar-placeholder.svg'
      },
      createdAt: new Date('2024-01-13T09:15:00'),
      updatedAt: new Date('2024-01-13T09:15:00'),
      tags: ['urgent', 'legislation'],
      replies: 23,
      likes: 31,
      isLiked: false,
      isEndingSoon: true
    }
  ];

  const allTags = Array.from(new Set(discussions.flatMap(discussion => discussion.tags)));

  const filteredDiscussions = discussions.filter(discussion => {
    const matchesSearch = discussion.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         discussion.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         discussion.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const sortedDiscussions = [...filteredDiscussions].sort((a, b) => {
    switch (sortBy) {
      case 'new':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'top':
        return b.likes - a.likes;
      case 'ending-soon':
        return (b.isEndingSoon ? 1 : 0) - (a.isEndingSoon ? 1 : 0);
      default:
        return 0;
    }
  });

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleLike = (discussionId: string) => {
    // TODO: Implement like functionality
    console.log('Like discussion:', discussionId);
  };

  const handleReply = (discussionId: string) => {
    // TODO: Implement reply functionality
    console.log('Reply to discussion:', discussionId);
  };

  return (
    <div className="space-y-6 px-6 md:px-10">
      {/* Header and Controls */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#0B0B0F]">Discussions</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              Start Discussion
            </Button>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C] w-4 h-4" />
            <Input
              placeholder="Search discussions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center border border-[#E6E8EC] rounded-lg">
            <Button
              variant={sortBy === 'new' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('new')}
              className="rounded-r-none"
            >
              New
            </Button>
            <Button
              variant={sortBy === 'top' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('top')}
              className="rounded-none"
            >
              Top
            </Button>
            <Button
              variant={sortBy === 'ending-soon' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('ending-soon')}
              className="rounded-l-none"
            >
              Ending Soon
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-4 pt-4 border-t border-[#E6E8EC]">
            <div>
              <label className="block text-sm font-medium text-[#60646C] mb-2">
                Filter by Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge key={tag} variant="outline" className="cursor-pointer">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Discussions List */}
      {sortedDiscussions.length > 0 ? (
        <div className="space-y-4">
          {sortedDiscussions.map(discussion => (
            <div
              key={discussion.id}
              className={`rounded-2xl border shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow ${
                discussion.isEndingSoon 
                  ? 'border-orange-200 bg-orange-50' 
                  : 'border-[#E6E8EC] bg-white'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <Avatar className="w-10 h-10">
                  <AvatarImage src={discussion.author.avatar} />
                  <AvatarFallback>
                    {discussion.author.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-[#0B0B0F] mb-1 line-clamp-2">
                        {discussion.title}
                        {discussion.isEndingSoon && (
                          <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Ending Soon
                          </Badge>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-[#60646C] mb-2">
                        <span>@{discussion.author.username}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(discussion.createdAt)}</span>
                        {discussion.updatedAt.getTime() !== discussion.createdAt.getTime() && (
                          <>
                            <span>•</span>
                            <span>edited</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[#60646C]">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-sm text-[#60646C] mb-3 line-clamp-3">
                    {discussion.content}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {discussion.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(discussion.id)}
                      className={`flex items-center gap-1 ${
                        discussion.isLiked ? 'text-[#FF6A00]' : 'text-[#60646C]'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      {discussion.likes}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReply(discussion.id)}
                      className="flex items-center gap-1 text-[#60646C]"
                    >
                      <Reply className="w-4 h-4" />
                      {discussion.replies}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#0B0B0F] mb-2">No discussions found</h3>
          <p className="text-[#60646C] mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Be the first to start a discussion in this patch'
            }
          </p>
          <Button className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
            <MessageSquare className="w-4 h-4 mr-2" />
            Start Discussion
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Video, 
  Image, 
  FileText, 
  Link as LinkIcon, 
  X, 
  Edit3, 
  Trash2,
  Play,
  Eye,
  Download,
  Calendar,
  Tag,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Post {
  id: string;
  content: string;
  videoUrl?: string;
  imageUrls?: string[];
  audioUrl?: string;
  createdAt: Date;
  user: {
    name: string;
    username: string;
    avatar: string;
  };
  tags?: string[];
}

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  content: any[];
}

interface PostTimelineIntegrationProps {
  posts: Post[];
  timelineEvents: TimelineEvent[];
  onEventUpdate: (eventId: string, updatedEvent: TimelineEvent) => void;
  onPostToTimeline: (postId: string, eventId: string) => void;
}

export default function PostTimelineIntegration({ 
  posts, 
  timelineEvents, 
  onEventUpdate, 
  onPostToTimeline 
}: PostTimelineIntegrationProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostSelector, setShowPostSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState<Post[]>(posts);

  // Filter posts based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
    } else {
      const filtered = posts.filter(post => 
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      );
      setFilteredPosts(filtered);
    }
  }, [searchQuery, posts]);

  const handlePostToTimeline = (post: Post, event: TimelineEvent) => {
    // Convert post to timeline content
    const timelineContent = {
      id: `post-${post.id}`,
      type: post.videoUrl ? 'video' : post.imageUrls?.length ? 'image' : 'text',
      title: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
      description: post.content,
      url: post.videoUrl || post.imageUrls?.[0] || '',
      thumbnail: post.imageUrls?.[0],
      author: post.user.name,
      date: post.createdAt.toISOString(),
      source: 'carrot-post'
    };

    // Add to event content
    const updatedEvent = {
      ...event,
      content: [...event.content, timelineContent]
    };

    onEventUpdate(event.id, updatedEvent);
    onPostToTimeline(post.id, event.id);
    setShowPostSelector(false);
  };

  const removeContentFromEvent = (event: TimelineEvent, contentId: string) => {
    const updatedEvent = {
      ...event,
      content: event.content.filter(content => content.id !== contentId)
    };
    onEventUpdate(event.id, updatedEvent);
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-green-500" />;
      case 'image': return <Image className="w-4 h-4 text-blue-500" />;
      case 'pdf': return <FileText className="w-4 h-4 text-red-500" />;
      case 'link': return <LinkIcon className="w-4 h-4 text-purple-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Post-Timeline Integration</h2>
          <p className="text-gray-600">Connect your Carrot posts with timeline events</p>
        </div>
        <Button 
          onClick={() => setShowPostSelector(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Post to Timeline
        </Button>
      </div>

      {/* Timeline Events with Connected Posts */}
      <div className="space-y-6">
        {timelineEvents.map((event) => (
          <div key={event.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Event Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-medium text-gray-600">{event.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                  <p className="text-gray-600 mt-1">{event.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedEvent(event);
                    setShowPostSelector(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Content
                </Button>
              </div>
            </div>

            {/* Connected Content */}
            {event.content && event.content.length > 0 ? (
              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Connected Content ({event.content.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {event.content.map((content: any, index: number) => (
                    <div key={content.id || index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {/* Content Header */}
                      <div className="p-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getContentTypeIcon(content.type)}
                            <span className="text-xs font-medium text-gray-600 capitalize">{content.type}</span>
                            {content.source === 'carrot-post' && (
                              <Badge variant="secondary" className="text-xs">Carrot Post</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContentFromEvent(event, content.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <h5 className="font-medium text-gray-900 mt-2 text-sm">{content.title}</h5>
                        {content.author && (
                          <p className="text-xs text-gray-500 mt-1">by {content.author}</p>
                        )}
                      </div>
                      
                      {/* Content Preview */}
                      <div className="p-3">
                        {content.type === 'video' && content.url && (
                          <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                            <video
                              src={content.url}
                              controls
                              className="w-full h-full"
                              poster={content.thumbnail}
                            >
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        )}
                        
                        {content.type === 'image' && content.url && (
                          <img
                            src={content.url}
                            alt={content.title}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        )}
                        
                        {content.type === 'text' && (
                          <p className="text-sm text-gray-700 line-clamp-3">{content.description}</p>
                        )}
                        
                        {content.date && (
                          <p className="text-xs text-gray-500 mt-2">{formatDate(content.date)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No content connected to this event</p>
                <p className="text-sm">Add posts or other content to bring this timeline event to life</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Post Selector Modal */}
      {showPostSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Post to {selectedEvent ? `"${selectedEvent.title}"` : 'Timeline Event'}
              </h3>
              <button
                onClick={() => {
                  setShowPostSelector(false);
                  setSelectedEvent(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search posts by content, author, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Posts List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredPosts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Post Preview */}
                    <div className="flex-shrink-0">
                      {post.videoUrl ? (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Video className="w-6 h-6 text-green-500" />
                        </div>
                      ) : post.imageUrls?.length ? (
                        <img
                          src={post.imageUrls[0]}
                          alt="Post preview"
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Post Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src={post.user.avatar}
                          alt={post.user.name}
                          className="w-6 h-6 rounded-full"
                        />
                        <span className="font-medium text-sm">{post.user.name}</span>
                        <span className="text-xs text-gray-500">@{post.user.username}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{formatDate(post.createdAt.toISOString())}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2 line-clamp-2">{post.content}</p>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Button */}
                    <div className="flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedEvent) {
                            handlePostToTimeline(post, selectedEvent);
                          }
                        }}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredPosts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No posts found</p>
                <p className="text-sm">Try adjusting your search terms</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

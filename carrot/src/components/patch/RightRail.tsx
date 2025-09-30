'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Bot, Plus, Activity } from 'lucide-react';

interface Patch {
  id: string;
  name: string;
  _count: {
    members: number;
  };
}

interface Follower {
  id: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
}

interface BotSubscription {
  id: string;
  botId: string;
  bot: {
    id: string;
    name: string;
    avatar?: string;
  };
  lastIndexed?: string;
}

interface RightRailProps {
  patch: Patch;
  followers?: Follower[];
  botSubscriptions?: BotSubscription[];
  followerCount?: number;
}

export default function RightRail({ 
  patch, 
  followers = [], 
  botSubscriptions = [],
  followerCount = 0
}: RightRailProps) {
  const handleConnectAgent = () => {
    console.log('Connect agent clicked');
    // TODO: Implement agent connection
  };

  const formatLastIndexed = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6 px-6 md:px-8">
      {/* Followers & AI Agents Card */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="space-y-6">
          {/* Followers Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
                <Users className="w-5 h-5" />
                Followers
              </h3>
              <Badge variant="secondary" className="bg-[#FF6A00]/10 text-[#FF6A00]">
                {followerCount}
              </Badge>
            </div>
            
            {followers.length > 0 ? (
              <div className="space-y-3">
                <div className="flex -space-x-2">
                  {followers.slice(0, 5).map((follower) => (
                    <Avatar key={follower.id} className="w-8 h-8 border-2 border-white">
                      <AvatarImage src={follower.user.image || ''} />
                      <AvatarFallback className="text-xs">
                        {follower.user.name?.charAt(0) || follower.user.username?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {followers.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                      <span className="text-xs text-gray-600">+{followers.length - 5}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-[#60646C]">
                  {followers.length} people following {patch.name}
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-[#60646C]">No followers yet</p>
                <p className="text-xs text-[#60646C] mt-1">Be the first to follow this patch</p>
              </div>
            )}
          </div>

          {/* AI Agents Section */}
          <div className="border-t border-[#E6E8EC] pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[#0B0B0F] flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Agents
              </h3>
            </div>
            
            {botSubscriptions.length > 0 ? (
              <div className="space-y-3">
                {botSubscriptions.map((subscription) => (
                  <div key={subscription.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={subscription.bot.avatar} />
                        <AvatarFallback className="text-xs">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-[#0B0B0F]">
                          {subscription.bot.name}
                        </p>
                        <p className="text-xs text-[#60646C] flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Last indexed {formatLastIndexed(subscription.lastIndexed)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Bot className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-[#60646C]">No agents connected</p>
                <p className="text-xs text-[#60646C] mt-1 leading-relaxed">
                  Connect AI agents<br />
                  to monitor this patch
                </p>
                <Button
                  onClick={handleConnectAgent}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Connect an Agent
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Update Cadence Info (Optional) */}
      {botSubscriptions.length > 0 && (
        <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
          <h3 className="text-lg font-semibold text-[#0B0B0F] mb-3">Update Cadence</h3>
          <div className="space-y-2 text-sm text-[#60646C]">
            <div className="flex justify-between">
              <span>Indexing frequency:</span>
              <span className="font-medium">Every 6 hours</span>
            </div>
            <div className="flex justify-between">
              <span>Last full sync:</span>
              <span className="font-medium">{formatLastIndexed(botSubscriptions[0]?.lastIndexed)}</span>
            </div>
            <div className="flex justify-between">
              <span>Next scheduled:</span>
              <span className="font-medium">In 2 hours</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

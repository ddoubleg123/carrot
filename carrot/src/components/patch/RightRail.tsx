'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Bot, Plus, Activity, Globe, Search, Calendar, FileText } from 'lucide-react';
import AgentConnectionModal from './AgentConnectionModal';

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
    profilePhoto: string | null;
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

interface ConnectedAgent {
  id: string;
  name: string;
  type: string;
  description: string;
  lastIndexed: string;
  status: 'active' | 'inactive';
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
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [connectedAgents, setConnectedAgents] = useState<ConnectedAgent[]>([]);

  const handleConnectAgent = () => {
    setIsAgentModalOpen(true);
  };

  const handleAgentConnect = (agentData: any) => {
    // Create a new connected agent
    const newAgent: ConnectedAgent = {
      id: `agent-${Date.now()}`,
      name: agentData.name,
      type: agentData.type,
      description: agentData.description,
      lastIndexed: new Date().toISOString(),
      status: 'active'
    };
    
    setConnectedAgents(prev => [...prev, newAgent]);
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'news-monitor': return Globe;
      case 'social-tracker': return Search;
      case 'event-detector': return Calendar;
      case 'content-analyzer': return FileText;
      default: return Bot;
    }
  };

  const getAgentColor = (type: string) => {
    switch (type) {
      case 'news-monitor': return 'bg-blue-500';
      case 'social-tracker': return 'bg-green-500';
      case 'event-detector': return 'bg-orange-500';
      case 'content-analyzer': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
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
    <div className="space-y-6 w-full max-w-sm min-w-0">
      {/* Fixed container bleeding v5 - strict width constraints with min-width */}
      {/* Followers & AI Agents Card */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-4 w-full max-w-sm min-w-0 overflow-hidden">
        <div className="space-y-6">
          {/* Followers Section */}
          <div>
            <div className="grid grid-cols-[24px_1fr] items-start gap-x-3 mb-4">
              <div className="flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  Followers
                </h3>
                <Badge variant="secondary" className="bg-[#FF6A00]/10 text-[#FF6A00]">
                  {followerCount}
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-[24px_1fr] items-start gap-x-3">
              <div></div>
              <div>
                {followers.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex -space-x-2">
                      {followers.slice(0, 5).map((follower) => {
                        // Use database profilePhoto first, fallback to Google Auth image
                        const avatarSrc = follower.user.profilePhoto || follower.user.image || '';
                        return (
                          <Avatar key={follower.id} className="w-8 h-8 border-2 border-white">
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback className="text-xs">
                              {follower.user.name?.charAt(0) || follower.user.username?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                      {followers.length > 5 && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                          <span className="text-xs text-gray-600">+{followers.length - 5}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {followers.length} people following {patch.name}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">No followers yet</p>
                    <p className="text-xs text-slate-600 mt-1">Be the first to follow this patch</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Agents Section */}
          <div className="border-t border-[#E6E8EC] pt-6">
            <div className="grid grid-cols-[24px_1fr] items-start gap-x-3 mb-4">
              <div className="flex items-center justify-center">
                <Bot className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  AI Agents
                </h3>
              </div>
            </div>
            
            <div className="grid grid-cols-[24px_1fr] items-start gap-x-3">
              <div></div>
              <div>
                {connectedAgents.length > 0 ? (
                  <div className="space-y-3">
                    {connectedAgents.map((agent) => {
                      const Icon = getAgentIcon(agent.type);
                      const colorClass = getAgentColor(agent.type);
                      return (
                        <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {agent.name}
                              </p>
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                Last indexed {formatLastIndexed(agent.lastIndexed)}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {agent.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Bot className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">No agents connected</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
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
        </div>
      </div>

      {/* Agent Connection Modal */}
      <AgentConnectionModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        onConnect={handleAgentConnect}
      />

      {/* Update Cadence Info (Optional) */}
      {connectedAgents.length > 0 && (
        <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-4 w-full max-w-sm min-w-0 overflow-hidden">
          <div className="grid grid-cols-[24px_1fr] items-start gap-x-3 mb-3">
            <div className="flex items-center justify-center">
              <Activity className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Update Cadence</h3>
            </div>
          </div>
          <div className="grid grid-cols-[24px_1fr] items-start gap-x-3">
            <div></div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Indexing frequency:</span>
                <span className="font-medium">Every 6 hours</span>
              </div>
              <div className="flex justify-between">
                <span>Last full sync:</span>
                <span className="font-medium">{formatLastIndexed(connectedAgents[0]?.lastIndexed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Next scheduled:</span>
                <span className="font-medium">In 2 hours</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

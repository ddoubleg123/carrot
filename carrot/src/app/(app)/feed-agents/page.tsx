'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Users, Brain, BookOpen, Upload, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import MemoryViewer from '@/components/ai-agents/MemoryViewer';
import BatchFeedModal from '@/components/ai-agents/BatchFeedModal';
import AgentTrainingWorkflow from '@/components/ai-agents/AgentTrainingWorkflow';

interface Agent {
  id: string;
  name: string;
  persona: string;
  domainExpertise: string[];
  associatedPatches: string[];
  metadata: {
    role?: string;
    expertise?: string[];
    avatar?: string;
    councilMembership?: string[];
    userVisibility?: string;
    trainingEnabled?: boolean;
  };
  createdAt: string;
}

interface FeedPreview {
  content: string;
  sourceType: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  chunks: string[];
  estimatedMemories: number;
}

export default function FeedAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [feedContent, setFeedContent] = useState('');
  const [sourceType, setSourceType] = useState('manual');
  
  // Check if we're on Render (where AI training might be disabled)
  const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showTrainingWorkflow, setShowTrainingWorkflow] = useState(false);

  // Check server info on mount
  useEffect(() => {
    if (isProduction) {
      // Try to get server info by making a test request
      fetch('/api/agents/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          operation: 'feed',
          agentIds: ['test'],
          feedItem: { content: 'test', sourceType: 'manual' }
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.results?.serverInfo) {
          setServerInfo(data.results.serverInfo);
        }
      })
      .catch(() => {
        // Ignore errors - just means we can't get server info
      });
    }
  }, [isProduction]);
  const [selectedAgentForTraining, setSelectedAgentForTraining] = useState<Agent | null>(null);
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const handlePreview = async () => {
    if (!selectedAgent || !feedContent.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: feedContent,
          sourceType,
          sourceTitle: sourceTitle || undefined,
          sourceAuthor: sourceAuthor || undefined,
          sourceUrl: sourceUrl || undefined,
        }),
      });

      const data = await response.json();
      setPreview(data.preview);
    } catch (error) {
      console.error('Error previewing feed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeed = async () => {
    if (!selectedAgent || !feedContent.trim()) return;

    setIsFeeding(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: feedContent,
          sourceType,
          sourceTitle: sourceTitle || undefined,
          sourceAuthor: sourceAuthor || undefined,
          sourceUrl: sourceUrl || undefined,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Reset form
        setFeedContent('');
        setSourceTitle('');
        setSourceAuthor('');
        setSourceUrl('');
        setPreview(null);
        alert(`Successfully fed ${data.result.chunkCount} memory chunks to ${selectedAgent.name}`);
      } else {
        alert('Error feeding agent: ' + data.error);
      }
    } catch (error) {
      console.error('Error feeding agent:', error);
      alert('Error feeding agent');
    } finally {
      setIsFeeding(false);
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.domainExpertise.some(expertise => 
      expertise.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Training Status Banner */}
        {isProduction && (
          <div className={`mb-6 p-4 rounded-lg border ${
            serverInfo?.isFreeTier 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Zap className={`w-5 h-5 ${
                  serverInfo?.isFreeTier ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
              <div>
                <h3 className={`text-sm font-medium ${
                  serverInfo?.isFreeTier ? 'text-yellow-800' : 'text-green-800'
                }`}>
                  {serverInfo?.isFreeTier 
                    ? 'AI Training Disabled on Free Tier' 
                    : 'AI Training Available (Paid Server)'
                  }
                </h3>
                <p className={`text-sm mt-1 ${
                  serverInfo?.isFreeTier ? 'text-yellow-700' : 'text-green-700'
                }`}>
                  {serverInfo?.isFreeTier 
                    ? 'AI agent training is disabled on the free tier due to memory limitations. For full AI training capabilities, please run locally or upgrade to a paid server.'
                    : 'AI agent training is available on this paid server. You can use all training features.'
                  }
                </p>
                {serverInfo && (
                  <div className="mt-2 text-xs text-gray-600">
                    Server: {serverInfo.isRender ? 'Render' : 'Unknown'} | 
                    Memory: {serverInfo.memoryUsage} / {serverInfo.totalMemory} | 
                    Tier: {serverInfo.isFreeTier ? 'Free' : 'Paid'}
                  </div>
                )}
                {serverInfo?.isFreeTier && (
                  <div className="mt-2">
                    <a 
                      href="/AI_TRAINING_SETUP.md" 
                      className="text-sm text-yellow-800 underline hover:text-yellow-900"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View setup instructions →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Agent Training</h1>
              <p className="text-gray-600">Feed knowledge to AI agents and manage their memories</p>
            </div>
            <Button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              disabled={isProduction && serverInfo?.isFreeTier}
            >
              <Zap className="w-4 h-4" />
              Batch Feed
            </Button>
          </div>
        </div>

        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agents">Agent Registry</TabsTrigger>
            <TabsTrigger value="feed">Feed Content</TabsTrigger>
            <TabsTrigger value="memories">Memory Viewer</TabsTrigger>
            <TabsTrigger value="training">Training Tracker</TabsTrigger>
          </TabsList>

          {/* Agent Registry Tab */}
          <TabsContent value="agents" className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search agents by name or expertise..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {agent.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription>
                          {agent.metadata.role || 'AI Agent'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {agent.persona}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {agent.domainExpertise.slice(0, 3).map((expertise) => (
                        <Badge key={expertise} variant="secondary" className="text-xs">
                          {expertise}
                        </Badge>
                      ))}
                      {agent.domainExpertise.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{agent.domainExpertise.length - 3} more
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <Brain className="w-4 h-4 mr-1" />
                        Feed
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedAgentForTraining(agent);
                          setShowTrainingWorkflow(true);
                        }}
                      >
                        <Zap className="w-4 h-4 mr-1" />
                        Train
                      </Button>
                      <Button size="sm" variant="outline">
                        <BookOpen className="w-4 h-4 mr-1" />
                        View Memories
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Feed Content Tab */}
          <TabsContent value="feed" className="space-y-6">
            {selectedAgent ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feed Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Feed Content to {selectedAgent.name}</CardTitle>
                    <CardDescription>
                      Add new knowledge to this agent's memory
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="sourceType">Source Type</Label>
                      <Select value={sourceType} onValueChange={setSourceType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual Input</SelectItem>
                          <SelectItem value="url">Web URL</SelectItem>
                          <SelectItem value="file">File Upload</SelectItem>
                          <SelectItem value="post">Carrot Post</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {sourceType === 'url' && (
                      <div>
                        <Label htmlFor="sourceUrl">Source URL</Label>
                        <Input
                          id="sourceUrl"
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          placeholder="https://example.com/article"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="sourceTitle">Title (Optional)</Label>
                      <Input
                        id="sourceTitle"
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                        placeholder="Article or document title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sourceAuthor">Author (Optional)</Label>
                      <Input
                        id="sourceAuthor"
                        value={sourceAuthor}
                        onChange={(e) => setSourceAuthor(e.target.value)}
                        placeholder="Author name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={feedContent}
                        onChange={(e) => setFeedContent(e.target.value)}
                        placeholder="Enter the content to feed to the agent..."
                        rows={8}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handlePreview}
                        disabled={!feedContent.trim() || isLoading}
                        variant="outline"
                      >
                        {isLoading ? 'Previewing...' : 'Preview'}
                      </Button>
                      <Button
                        onClick={handleFeed}
                        disabled={!feedContent.trim() || isFeeding}
                      >
                        {isFeeding ? 'Feeding...' : 'Feed Agent'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview Panel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Feed Preview</CardTitle>
                    <CardDescription>
                      See how the content will be processed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {preview ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Content Summary</h4>
                          <p className="text-sm text-gray-600 line-clamp-3">
                            {preview.content}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Processing Details</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Source Type:</strong> {preview.sourceType}</p>
                            {preview.sourceTitle && (
                              <p><strong>Title:</strong> {preview.sourceTitle}</p>
                            )}
                            {preview.sourceAuthor && (
                              <p><strong>Author:</strong> {preview.sourceAuthor}</p>
                            )}
                            <p><strong>Chunks:</strong> {preview.chunks.length}</p>
                            <p><strong>Estimated Memories:</strong> {preview.estimatedMemories}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Content Chunks</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {preview.chunks.map((chunk, index) => (
                              <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                                <strong>Chunk {index + 1}:</strong> {chunk.substring(0, 100)}...
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Click "Preview" to see how the content will be processed
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to start feeding content
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Memory Viewer Tab */}
          <TabsContent value="memories" className="space-y-6">
            {selectedAgent ? (
              <MemoryViewer agentId={selectedAgent.id} agentName={selectedAgent.name} />
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to view their memories
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Training Tracker Tab */}
          <TabsContent value="training" className="space-y-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Training Tracker</h3>
              <p className="text-gray-600">Training tracking functionality coming soon.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Batch Feed Modal */}
      <BatchFeedModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        agents={agents}
      />

      {/* Agent Training Workflow Modal */}
      {selectedAgentForTraining && (
        <AgentTrainingWorkflow
          agent={selectedAgentForTraining}
          onClose={() => {
            setShowTrainingWorkflow(false);
            setSelectedAgentForTraining(null);
          }}
        />
      )}
    </div>
  );
}

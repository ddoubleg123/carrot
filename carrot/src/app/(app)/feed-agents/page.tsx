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
import StudyRecord from '@/components/ai-agents/StudyRecord';
import BatchFeedModal from '@/components/ai-agents/BatchFeedModal';
import AgentTrainingWorkflow from '@/components/ai-agents/AgentTrainingWorkflow';
import AgentTrainingDashboard from '@/components/ai-agents/AgentTrainingDashboard';
import AgentSelfAssessmentChat from '@/components/ai-agents/AgentSelfAssessmentChat';
import { FEATURED_AGENTS } from '@/lib/agents';
import { OptimizedImage, AvatarImage } from '@/components/ui/OptimizedImage';

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
  const [activeTab, setActiveTab] = useState<'agents'|'feed'|'memories'|'training'|'dashboard'>('agents');
  const [showTrainingWorkflow, setShowTrainingWorkflow] = useState(false);
  // Restored state
  const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  // Learn topics modal & tracker
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [assessmentText, setAssessmentText] = useState('');
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [topicsFromDeepseek, setTopicsFromDeepseek] = useState<string[]>([]);

  // Learn topics: parse + create training plan
  const extractTopicsFromAssessment = (text: string): string[] => {
    // Collect bullet lines and headings as topics; simple heuristic
    const lines = text.split(/\r?\n/);
    const topics: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (/^[-*•]\s+/.test(line)) {
        const t = line.replace(/^[-*•]\s+/, '').replace(/^[**_`\-\d.\)]+\s*/, '').trim();
        if (t) topics.push(t);
      } else if (/^##?\s+/.test(line)) {
        // Include H2/H3 section titles as higher-level topics optionally
        const t = line.replace(/^##?\s+/, '').trim();
        if (t && !/^recommended resources|professional|how to use/i.test(t)) topics.push(t);
      }
    }
    // Normalize, dedupe, limit length
    const norm = topics
      .map(t => t.replace(/[:\-–—]+$/, '').trim())
      .filter(Boolean)
      .map(t => t.length > 140 ? t.slice(0, 140) : t);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of norm) {
      const key = t.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(t); }
    }
    return out;
  };

  const submitTrainingPlan = async () => {
    if (!selectedAgent) return;
    const topics = extractTopicsFromAssessment(assessmentText);
    if (!topics.length) { alert('No topics detected. Paste the self-assessment text.'); return; }
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, options: { perTopicMax: 200, throttleMs: 6000, maxTasksPerTick: 1 } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { alert('Failed to create training plan: ' + (data.error || res.statusText)); return; }
      setLastPlanId(data.planId);
      setShowLearnModal(false);
      alert(`Training plan created with ${topics.length} topics. Tracking progress in Training tab.`);
    } catch (e) {
      alert('Error creating training plan');
    }
  };

  const submitTrainingPlanFromTopics = async () => {
    if (!selectedAgent) return;
    const topics = topicsFromDeepseek;
    if (!topics || !topics.length) { setShowLearnModal(true); return; }
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, options: { perTopicMax: 200, throttleMs: 6000, maxTasksPerTick: 1 } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { alert('Failed to create training plan: ' + (data.error || res.statusText)); return; }
      setLastPlanId(data.planId);
      alert(`Training plan created with ${topics.length} topics from Deepseek. Tracking progress in Training tab.`);
    } catch (e) {
      alert('Error creating training plan');
    }
  };

  // Poll plan status when lastPlanId is set
  useEffect(() => {
    if (!selectedAgent || !lastPlanId) return;
    let t: any;
    const poll = async () => {
      try {
        const r = await fetch(`/api/agents/${selectedAgent.id}/training-plan/${lastPlanId}`, { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) setPlanStatus(j); else setPlanStatus(null);
      } catch {}
      t = setTimeout(poll, 3000);
    };
    poll();
    return () => { if (t) clearTimeout(t); };
  }, [selectedAgent?.id, lastPlanId]);

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
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<any[]>([]);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      // Load database agents
      const response = await fetch('/api/agents');
      const data = await response.json();
      const dbAgents = data.agents || [];
      
      // Convert featured agents to the expected format
      const featuredAgents = FEATURED_AGENTS.map(agent => ({
        id: agent.id,
        name: agent.name,
        persona: agent.personality.approach,
        domainExpertise: agent.domains,
        associatedPatches: [],
        metadata: {
          role: agent.personality.expertise,
          expertise: agent.strengths,
          avatar: agent.avatar,
          councilMembership: [],
          userVisibility: 'public',
          trainingEnabled: true
        },
        createdAt: new Date().toISOString()
      }));
      
      // Combine database agents and featured agents, removing duplicates
      const allAgents = [...dbAgents];
      featuredAgents.forEach(featuredAgent => {
        if (!allAgents.find(agent => agent.id === featuredAgent.id)) {
          allAgents.push(featuredAgent);
        }
      });
      
      setAgents(allAgents);
      
      // Auto-select the first agent if none is selected
      if (allAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(allAgents[0]);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  // Parse comma/newline separated tags, dedupe while preserving order
  const parseTags = (raw: string): string[] => {
    try {
      const items = raw
        .split(/[\n,]/g)
        .map(s => s.trim())
        .filter(Boolean)
      const seen = new Set<string>()
      const out: string[] = []
      for (const t of items) {
        const key = t.toLowerCase()
        if (!seen.has(key)) { seen.add(key); out.push(t) }
      }
      return out
    } catch {
      return []
    }
  }

  const handlePreview = async () => {
    if (!selectedAgent || !feedContent.trim()) return;

    setIsLoading(true);
    try {
      const tags = parseTags(tagsInput);
      const response = await fetch(`/api/agents/${selectedAgent.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: feedContent,
          sourceType,
          sourceTitle: sourceTitle || undefined,
          sourceAuthor: sourceAuthor || undefined,
          sourceUrl: sourceUrl || undefined,
          tags,
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
      const tags = parseTags(tagsInput);
      const response = await fetch(`/api/agents/${selectedAgent.id}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: feedContent,
          sourceType,
          sourceTitle: sourceTitle || undefined,
          sourceAuthor: sourceAuthor || undefined,
          sourceUrl: sourceUrl || undefined,
          tags,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Reset form
        setFeedContent('');
        setSourceTitle('');
        setSourceAuthor('');
        setSourceUrl('');
        setTagsInput('');
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

  const handleAutoRetrieve = async () => {
    if (!retrievalQuery.trim() || !selectedAgent) return;

    setIsRetrieving(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/retrieve-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: retrievalQuery,
          sourceTypes: ['wikipedia', 'arxiv', 'news', 'academic', 'pubmed', 'stackoverflow', 'github', 'books'],
          maxResults: 20, // Increased from 5 to 20
          autoFeed: true
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setRetrievalResults(data.results || []);
        alert(`Successfully retrieved and fed ${data.results?.length || 0} pieces of content to ${selectedAgent.name}`);
        setRetrievalQuery('');
      } else {
        alert('Error retrieving content: ' + data.error);
      }
    } catch (error) {
      console.error('Error in auto-retrieve:', error);
      alert('Error retrieving content');
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleDeepLearning = async () => {
    if (!selectedAgent) return;

    setIsRetrieving(true);
    try {
      // Deep learning mode: comprehensive training across all expertise areas
      const response = await fetch(`/api/agents/${selectedAgent.id}/deep-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTypes: ['wikipedia', 'arxiv', 'news', 'academic', 'pubmed', 'stackoverflow', 'github', 'books', 'papers'],
          maxResults: 50, // Much more comprehensive
          autoFeed: true
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setRetrievalResults(data.results || []);
        alert(`Deep learning complete! Fed ${data.results?.length || 0} pieces of content to ${selectedAgent.name}`);
      } else {
        alert('Error in deep learning: ' + data.error);
      }
    } catch (error) {
      console.error('Error in deep learning:', error);
      alert('Error in deep learning');
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleWikipediaDeepLearning = async () => {
    if (!selectedAgent) return;

    // Get a Wikipedia page suggestion based on agent expertise
    const pageTitle = getWikipediaSuggestion(selectedAgent);
    
    setIsRetrieving(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/wikipedia-deep-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageTitle,
          includeReferences: true,
          maxReferences: 15,
          minReliability: 'medium'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Wikipedia deep learning complete! Processed ${data.result?.processedReferences || 0} references for ${selectedAgent.name} from "${pageTitle}"`);
      } else {
        alert('Error in Wikipedia deep learning: ' + data.error);
      }
    } catch (error) {
      console.error('Error in Wikipedia deep learning:', error);
      alert('Error in Wikipedia deep learning');
    } finally {
      setIsRetrieving(false);
    }
  };

  const getWikipediaSuggestion = (agent: any): string => {
    // Generate a Wikipedia page suggestion based on agent expertise
    for (const domain of agent.domainExpertise) {
      switch (domain.toLowerCase()) {
        case 'physics':
          return 'Quantum mechanics';
        case 'economics':
          return 'Economics';
        case 'computer science':
          return 'Artificial intelligence';
        case 'biology':
          return 'Evolution';
        case 'civil rights':
          return 'Civil rights movement';
        case 'politics':
          return 'Democracy';
        default:
          return 'Science';
      }
    }
    return 'Science';
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
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  AI Training Available
                </h3>
                <p className="text-sm mt-1 text-green-700">
                  AI agent training is now enabled on this server. You can use all training features with improved memory management.
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

          {/* Agent Selector */}
          <div className="mt-6 mb-6">
            <Label htmlFor="agent-select" className="text-sm font-medium text-gray-700 mb-2 block">
              Select Agent to Train
            </Label>
            <Select
              value={selectedAgent?.id || ''}
              onValueChange={(agentId) => {
                const agent = agents.find(a => a.id === agentId);
                setSelectedAgent(agent || null);
              }}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose an agent to train..." />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                {filteredAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id} className="bg-white hover:bg-gray-50 focus:bg-gray-50">
                    <div className="flex items-center gap-2 w-full">
                      {agent.metadata.avatar ? (
                        <AvatarImage
                          src={agent.metadata.avatar}
                          alt={agent.name}
                          size={32}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium text-sm flex-shrink-0">
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{agent.name}</div>
                        <div className="text-xs text-gray-500 truncate">{agent.domainExpertise.slice(0, 2).join(', ')}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v)=> setActiveTab(v as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="agents">Agent Registry</TabsTrigger>
            <TabsTrigger value="feed">Feed Content</TabsTrigger>
            <TabsTrigger value="memories">Memory Viewer</TabsTrigger>
            <TabsTrigger value="training">Training Tracker</TabsTrigger>
            <TabsTrigger value="dashboard">Training Dashboard</TabsTrigger>
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
                      {agent.metadata.avatar ? (
                        <AvatarImage
                          src={agent.metadata.avatar}
                          alt={agent.name}
                          size={48}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
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
                        onClick={() => { setSelectedAgent(agent); setActiveTab('feed'); }}
                        title="Feed content to this agent"
                      >
                        <Brain className="w-4 h-4 mr-1" />
                        Feed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedAgent(agent); setActiveTab('memories'); }}
                        title="Open memory viewer for this agent"
                      >
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
              <>
                {/* Agent Context Header */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        {selectedAgent.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-xl text-blue-900">
                          Training {selectedAgent.name}
                        </CardTitle>
                        <CardDescription className="text-blue-700">
                          {selectedAgent.metadata.role || 'AI Agent'} • {selectedAgent.domainExpertise.slice(0, 3).join(', ')}
                          {selectedAgent.domainExpertise.length > 3 && ` +${selectedAgent.domainExpertise.length - 3} more`}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-blue-600">Expertise Areas</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedAgent.domainExpertise.slice(0, 4).map((expertise) => (
                            <Badge key={expertise} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              {expertise}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Agent Self-Assessment Chat */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      {selectedAgent.name} Self-Assessment Chat
                    </CardTitle>
                    <CardDescription className="text-green-700">
                      {selectedAgent.name} analyzes their current knowledge and identifies areas for deeper learning
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AgentSelfAssessmentChat agent={selectedAgent} onTopics={(t)=> setTopicsFromDeepseek(t)} />
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-green-800">
                        {topicsFromDeepseek.length > 0 ? `${topicsFromDeepseek.length} topics detected from Deepseek` : 'No topics detected yet'}
                      </div>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={submitTrainingPlanFromTopics}>
                        {topicsFromDeepseek.length > 0 ? 'Learn these topics' : 'Parse & Learn topics'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent-Specific Automated Content Retrieval */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Smart Content Retrieval for {selectedAgent.name}
                    </CardTitle>
                    <CardDescription>
                      Automatically find and feed content relevant to {selectedAgent.name}'s expertise areas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Search for content relevant to ${selectedAgent.name} (e.g., '${selectedAgent.domainExpertise[0] || 'quantum mechanics'}')`}
            value={retrievalQuery}
            onChange={(e) => setRetrievalQuery(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleAutoRetrieve}
            disabled={!retrievalQuery.trim() || isRetrieving}
            className="bg-green-600 hover:bg-green-700"
          >
            {isRetrieving ? 'Retrieving...' : `Auto-Feed ${selectedAgent.name}`}
          </Button>
          <Button
            onClick={handleDeepLearning}
            disabled={isRetrieving}
            className="bg-blue-600 hover:bg-blue-700"
            title="Comprehensive learning with 50+ sources"
          >
            {isRetrieving ? 'Learning...' : 'Deep Learning'}
          </Button>
          <Button
            onClick={handleWikipediaDeepLearning}
            disabled={isRetrieving}
            className="bg-purple-600 hover:bg-purple-700"
            title="Deep Wikipedia learning with all references"
          >
            {isRetrieving ? 'Learning...' : 'Wikipedia Deep'}
          </Button>
        </div>
                    {retrievalResults.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Retrieval Results</h4>
                        <div className="text-sm text-green-700">
                          Successfully fed {retrievalResults.length} pieces of content to {selectedAgent.name}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent to Begin Training
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to start feeding content and training
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}

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
                      <Label htmlFor="tagsInput">Tags (comma or newline separated)</Label>
                      <Textarea
                        id="tagsInput"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Paste tags separated by commas or newlines"
                        rows={4}
                      />
                      <div className="text-xs text-gray-500 mt-1">We split on commas/newlines and remove duplicates.</div>
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
              <div className="space-y-6">
                <MemoryViewer agentId={selectedAgent.id} agentName={selectedAgent.name} />
                <StudyRecord agentId={selectedAgent.id} agentName={selectedAgent.name} />
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select an Agent
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose an agent from the registry to view their memories and study record
                  </p>
                  <Button onClick={() => setSelectedAgent(agents[0])}>
                    Select First Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Training Tracker Tab (single-agent focus) */}
          <TabsContent value="training" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Training Tracker {selectedAgent ? `• ${selectedAgent.name}` : ''}</h3>
              {!selectedAgent && (
                <p className="text-gray-600">Select an agent to view their training progress.</p>
              )}

              {selectedAgent && !lastPlanId && (
                <p className="text-gray-600">Create a training plan from the self-assessment to see live progress here.</p>
              )}

              {selectedAgent && planStatus && (
                <>
                  <div className="text-sm">
                    <div className="mb-2">Plan: <span className="font-mono">{lastPlanId}</span> • Status: <span className="font-medium">{planStatus.plan.status}</span></div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      <div className="p-2 bg-gray-50 rounded">Queued: {planStatus.plan.totals.queued}</div>
                      <div className="p-2 bg-gray-50 rounded">Running: {planStatus.plan.totals.running}</div>
                      <div className="p-2 bg-gray-50 rounded">Done: {planStatus.plan.totals.done}</div>
                      <div className="p-2 bg-gray-50 rounded">Failed: {planStatus.plan.totals.failed}</div>
                      <div className="p-2 bg-gray-50 rounded">Skipped: {planStatus.plan.totals.skipped}</div>
                      <div className="p-2 bg-gray-50 rounded">Fed: {planStatus.plan.totals.fed}</div>
                    </div>
                  </div>

                  {/* Per-topic progress list */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Trainable topics</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {planStatus.tasks?.map((t: any) => (
                        <div key={t.id} className="text-sm flex items-center justify-between border rounded px-2 py-1 bg-white">
                          <div className="truncate mr-3" title={`${t.topic} (page ${t.page})`}>{t.topic}</div>
                          <div className="text-xs text-gray-600">pg {t.page} • {t.status} • fed {t.itemsFed||0}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reuse dashboard chart for the single agent */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Coverage by expertise</h4>
                    <AgentTrainingDashboard 
                      selectedAgentId={selectedAgent?.id}
                      onAgentSelect={(agentId)=>{
                        const a = agents.find(a=> a.id===agentId); setSelectedAgent(a||null);
                      }}
                    />
                  </div>
                </>
              )}

              {selectedAgent && !planStatus && lastPlanId && (
                <p className="text-gray-600">Loading plan status…</p>
              )}
            </div>
          </TabsContent>

          {/* Training Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <AgentTrainingDashboard 
              selectedAgentId={selectedAgent?.id}
              onAgentSelect={(agentId) => {
                const agent = agents.find(a => a.id === agentId);
                setSelectedAgent(agent || null);
              }}
            />
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

      {/* Learn Topics Modal */}
      <Sheet open={showLearnModal} onOpenChange={setShowLearnModal}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Learn these topics</SheetTitle>
            <SheetDescription>Paste the self-assessment text. We will extract topics and create a durable training plan (200 items per topic by default).</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Label htmlFor="assessmentText">Self-assessment text</Label>
            <Textarea id="assessmentText" rows={14} value={assessmentText} onChange={(e)=> setAssessmentText(e.target.value)} placeholder="Paste the self-assessment here…" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setShowLearnModal(false)}>Cancel</Button>
              <Button onClick={submitTrainingPlan} className="bg-green-600 hover:bg-green-700">Create Training Plan</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

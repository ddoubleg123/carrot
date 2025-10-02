'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Brain, 
  BookOpen, 
  TrendingUp, 
  Calendar, 
  Search, 
  Download,
  RefreshCw,
  Target,
  BarChart3,
  FileText,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface AgentTrainingRecord {
  agentId: string;
  agentName: string;
  domainExpertise: string[];
  totalMemories: number;
  totalFeedEvents: number;
  lastTrainingDate: Date;
  trainingHistory: {
    date: Date;
    sourceType: string;
    sourceTitle: string;
    contentPreview: string;
    relevanceScore: number;
  }[];
  expertiseCoverage: {
    domain: string;
    coverage: number;
    lastUpdated: Date;
  }[];
}

interface TrainingDashboardProps {
  selectedAgentId?: string;
  onAgentSelect?: (agentId: string) => void;
  refreshToken?: string;
}

export default function AgentTrainingDashboard({ 
  selectedAgentId, 
  onAgentSelect,
  refreshToken,
}: TrainingDashboardProps) {
  const [trainingRecords, setTrainingRecords] = useState<AgentTrainingRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AgentTrainingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<any[]>([]);
  // Cumulative stats fallback (when no active batch/records)
  const [stats, setStats] = useState<null | {
    ok: boolean
    totals: { agents: number; plans: number; discoveries: number }
    byAgent: Array<{
      agentId: string
      agentName: string
      skills: string[]
      perSkill: Record<string, { retrieved: number; filtered: number; fed: number; failed: number }>
      totalSkills: number
      totalMemories: number
      totalFed: number
    }>
  }>(null)

  useEffect(() => {
    loadTrainingRecords();
    // Also load cumulative stats (always available)
    loadCumulativeStats();
  }, []);

  // Live refresh when a token changes (e.g., batch status updates)
  useEffect(() => {
    if (!refreshToken) return;
    loadTrainingRecords();
  }, [refreshToken]);

  useEffect(() => {
    if (selectedAgentId && trainingRecords.length > 0) {
      const record = trainingRecords.find(r => r.agentId === selectedAgentId);
      setSelectedRecord(record || null);
    }
  }, [selectedAgentId, trainingRecords]);

  const loadTrainingRecords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/agents/training-records');
      const data = await response.json();
      
      if (data.success) {
        setTrainingRecords(data.records);
      }
    } catch (error) {
      console.error('Error loading training records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCumulativeStats = async () => {
    try {
      const r = await fetch('/api/agents/training/stats', { cache: 'no-store' })
      const j = await r.json()
      if (j?.ok) setStats(j)
    } catch (e) {
      console.error('[AgentTrainingDashboard] Failed to load cumulative stats', e)
    }
  }

  const handleAgentSpecificRetrieval = async (agentId: string) => {
    try {
      setIsRetrieving(true);
      const response = await fetch(`/api/agents/${agentId}/retrieve-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxResults: 5,
          autoFeed: true,
          sourceTypes: ['wikipedia', 'arxiv']
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRetrievalResults(data.results);
        // Refresh training records to show updated data
        await loadTrainingRecords();
        alert(`Successfully retrieved and fed ${data.results.length} pieces of content to ${data.trainingRecord.agentName}`);
      } else {
        alert('Failed to retrieve agent-specific content');
      }
    } catch (error) {
      console.error('Error in agent-specific retrieval:', error);
      alert('Error retrieving content');
    } finally {
      setIsRetrieving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'text-green-600';
    if (coverage >= 60) return 'text-yellow-600';
    if (coverage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCoverageBgColor = (coverage: number) => {
    if (coverage >= 80) return 'bg-green-100';
    if (coverage >= 60) return 'bg-yellow-100';
    if (coverage >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading training records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agent Training Dashboard</h2>
          <p className="text-gray-600">Monitor and manage AI agent learning progress</p>
        </div>
        <Button onClick={() => { loadTrainingRecords(); loadCumulativeStats(); }} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Brain className="w-8 h-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900">{trainingRecords.length || stats?.totals.agents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Memories</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingRecords.length
                    ? trainingRecords.reduce((sum, record) => sum + record.totalMemories, 0)
                    : (stats?.byAgent || []).reduce((n, a) => n + (a.totalMemories || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Training Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingRecords.length
                    ? trainingRecords.reduce((sum, record) => sum + record.totalFeedEvents, 0)
                    : (stats?.byAgent || []).reduce((n, a) => n + (a.totalFed || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-orange-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Active Domains</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingRecords.length
                    ? new Set(trainingRecords.flatMap(r => r.domainExpertise)).size
                    : new Set((stats?.byAgent || []).flatMap(a => a.skills)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Details</TabsTrigger>
          <TabsTrigger value="training">Training History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Agent List - live records if present, otherwise cumulative stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(trainingRecords.length ? trainingRecords : (stats?.byAgent || [])).map((record: any) => (
              <Card 
                key={record.agentId} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedAgentId === record.agentId ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => onAgentSelect?.(record.agentId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{record.agentName}</CardTitle>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAgentSpecificRetrieval(record.agentId);
                      }}
                      disabled={isRetrieving}
                    >
                      {isRetrieving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {record.domainExpertise ? (
                    <CardDescription>{record.domainExpertise.join(', ')}</CardDescription>
                  ) : (
                    <CardDescription>Skills: {(record.skills || []).slice(0, 8).join(', ') || '—'}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Memories:</span>
                    <span className="font-medium">{record.totalMemories ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Training Events:</span>
                    <span className="font-medium">{record.totalFeedEvents ?? record.totalFed ?? 0}</span>
                  </div>
                  {record.lastTrainingDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Last Training:</span>
                      <span className="font-medium">{formatDate(record.lastTrainingDate)}</span>
                    </div>
                  )}
                  
                  {/* Expertise Coverage */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Expertise Coverage:</p>
                    {(record.expertiseCoverage || []).map((coverage: any, index: number) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{coverage.domain}</span>
                          <span className={getCoverageColor(coverage.coverage)}>
                            {coverage.coverage}%
                          </span>
                        </div>
                        <Progress 
                          value={coverage.coverage} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          {selectedRecord ? (
            <div className="space-y-6">
              {/* Agent Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    {selectedRecord.agentName} - Training Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Domain Expertise</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedRecord.domainExpertise.map((domain, index) => (
                          <Badge key={index} variant="secondary">{domain}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Training Stats</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Memories:</span>
                          <span className="font-medium">{selectedRecord.totalMemories}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Training Events:</span>
                          <span className="font-medium">{selectedRecord.totalFeedEvents}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Training:</span>
                          <span className="font-medium">{formatDate(selectedRecord.lastTrainingDate)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expertise Coverage Chart */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Expertise Coverage</h4>
                    <div className="space-y-3">
                      {selectedRecord.expertiseCoverage.map((coverage, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{coverage.domain}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${getCoverageColor(coverage.coverage)}`}>
                                {coverage.coverage}%
                              </span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getCoverageBgColor(coverage.coverage)}`}
                              >
                                {coverage.coverage >= 80 ? 'Excellent' : 
                                 coverage.coverage >= 60 ? 'Good' : 
                                 coverage.coverage >= 40 ? 'Fair' : 'Needs Work'}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={coverage.coverage} className="h-3" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Training History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Recent Training History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedRecord.trainingHistory.slice(0, 10).map((training, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0">
                          {training.sourceType === 'wikipedia' ? (
                            <FileText className="w-5 h-5 text-blue-500" />
                          ) : training.sourceType === 'arxiv' ? (
                            <BookOpen className="w-5 h-5 text-green-500" />
                          ) : (
                            <ExternalLink className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-gray-900 truncate">
                              {training.sourceTitle}
                            </h5>
                            <Badge variant="outline" className="text-xs">
                              {training.sourceType}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                training.relevanceScore >= 0.8 ? 'text-green-600' : 
                                training.relevanceScore >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                              }`}
                            >
                              {Math.round(training.relevanceScore * 100)}% relevant
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {training.contentPreview}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(training.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Agent</h3>
                <p className="text-gray-600">Choose an agent from the overview to view detailed training information</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Training Analytics
              </CardTitle>
              <CardDescription>
                Comprehensive view of all agent training activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Training Activity Timeline */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recent Training Activity</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {trainingRecords
                      .flatMap(record => 
                        record.trainingHistory.map(training => ({
                          ...training,
                          agentName: record.agentName,
                          agentId: record.agentId
                        }))
                      )
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 20)
                      .map((training, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-600">
                                {training.agentName.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{training.agentName}</span>
                              <Badge variant="outline" className="text-xs">
                                {training.sourceType}
                              </Badge>
                            </div>
                            <h5 className="font-medium text-gray-900 truncate mb-1">
                              {training.sourceTitle}
                            </h5>
                            <p className="text-sm text-gray-600 mb-2">
                              {training.contentPreview}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(training.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {Math.round(training.relevanceScore * 100)}% relevant
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

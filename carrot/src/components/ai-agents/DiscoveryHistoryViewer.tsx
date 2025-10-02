'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DiscoveryItem {
  id: string;
  planId: string;
  topic: string;
  page: number;
  url: string;
  title: string;
  sourceType: string;
  status: 'discovered' | 'filtered' | 'fed' | 'failed';
  ts: string;
}

interface DiscoveryHistoryViewerProps {
  planId?: string;
  agentId?: string;
  className?: string;
  showAllAgents?: boolean;
}

export default function DiscoveryHistoryViewer({ planId, agentId, className = '', showAllAgents = false }: DiscoveryHistoryViewerProps) {
  const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('__all__');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('__all__');

  // Get unique values for filters
  const uniqueTopics = [...new Set(discoveries.map(d => d.topic))];
  const uniqueSourceTypes = [...new Set(discoveries.map(d => d.sourceType))];

  // Filter discoveries based on current filters
  const filteredDiscoveries = discoveries.filter(discovery => {
    const matchesSearch = !searchQuery || 
      discovery.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discovery.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discovery.url.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTopic = topicFilter === '__all__' || discovery.topic === topicFilter;
    const matchesStatus = statusFilter === '__all__' || discovery.status === statusFilter;
    const matchesSourceType = sourceTypeFilter === '__all__' || discovery.sourceType === sourceTypeFilter;

    return matchesSearch && matchesTopic && matchesStatus && matchesSourceType;
  });

  // Load discoveries
  const loadDiscoveries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '500'); // Get more items for history view
      
      if (agentId) {
        params.set('agentId', agentId);
      }
      
      let url: string;
      if (showAllAgents || !planId) {
        // Use the new all-agents endpoint
        url = `/api/agents/training/discoveries?${params.toString()}`;
      } else {
        // Use the single-plan endpoint
        url = `/api/agents/training/plan/${planId}/discoveries?${params.toString()}`;
      }
      
      const response = await fetch(url, {
        cache: 'no-store'
      });
      
      const data = await response.json();
      if (data.ok) {
        setDiscoveries(data.discoveries || data.items || []);
      }
    } catch (error) {
      console.error('Failed to load discoveries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load discoveries on mount and when planId changes
  useEffect(() => {
    loadDiscoveries();
  }, [planId, agentId, showAllAgents]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!planId) return;
    
    const interval = setInterval(loadDiscoveries, 10000);
    return () => clearInterval(interval);
  }, [planId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'filtered':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'filtered':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  if (!planId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Discovery History</CardTitle>
          <CardDescription>Select an agent with an active training plan to view discovery history</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Discovery History
          {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />}
        </CardTitle>
        <CardDescription>
          All discovered content for this training plan ({discoveries.length} items)
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search title, topic, or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Topic</label>
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Topics ({uniqueTopics.length})</SelectItem>
                {uniqueTopics.map(topic => (
                  <SelectItem key={topic} value={topic}>
                    {topic} ({discoveries.filter(d => d.topic === topic).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="discovered">Discovered</SelectItem>
                <SelectItem value="filtered">Filtered</SelectItem>
                <SelectItem value="fed">Fed to Agent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Source</label>
            <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sources ({uniqueSourceTypes.length})</SelectItem>
                {uniqueSourceTypes.map(sourceType => (
                  <SelectItem key={sourceType} value={sourceType}>
                    {sourceType} ({discoveries.filter(d => d.sourceType === sourceType).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm text-blue-600">Total Discovered</div>
            <div className="text-2xl font-bold text-blue-900">{discoveries.length}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-sm text-green-600">Successfully Fed</div>
            <div className="text-2xl font-bold text-green-900">
              {discoveries.filter(d => d.status === 'fed').length}
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="text-sm text-yellow-600">Filtered Out</div>
            <div className="text-2xl font-bold text-yellow-900">
              {discoveries.filter(d => d.status === 'filtered').length}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-sm text-red-600">Failed</div>
            <div className="text-2xl font-bold text-red-900">
              {discoveries.filter(d => d.status === 'failed').length}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredDiscoveries.length} of {discoveries.length} items
            </div>
            <Button variant="outline" size="sm" onClick={loadDiscoveries} disabled={loading}>
              Refresh
            </Button>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredDiscoveries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {discoveries.length === 0 ? 'No discoveries yet' : 'No items match your filters'}
              </div>
            ) : (
              filteredDiscoveries.map((discovery) => (
                <div key={discovery.id} className="border rounded-lg p-3 bg-white hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(discovery.status)}
                        <h4 className="font-medium text-sm truncate" title={discovery.title}>
                          {discovery.title}
                        </h4>
                        <Badge variant="outline" className={getStatusColor(discovery.status)}>
                          {discovery.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {discovery.topic}
                          </Badge>
                        </span>
                        <span>{discovery.sourceType}</span>
                        <span>Page {discovery.page}</span>
                        <span>{formatTimestamp(discovery.ts)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <a
                          href={discovery.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 truncate"
                          title={discovery.url}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {discovery.url}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

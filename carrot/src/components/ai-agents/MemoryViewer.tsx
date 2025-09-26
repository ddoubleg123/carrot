'use client';

import { useState, useEffect } from 'react';
import { Search, Trash2, Eye, EyeOff, Calendar, Tag, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

interface Memory {
  id: string;
  content: string;
  sourceType: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  tags: string[];
  confidence: number;
  threadId?: string;
  topicId?: string;
  fedBy?: string;
  createdAt: string;
  similarity?: number;
}

interface MemoryStats {
  totalMemories: number;
  recentMemories: number;
  highConfidenceMemories: number;
}

interface MemoryViewerProps {
  agentId: string;
  agentName: string;
}

export default function MemoryViewer({ agentId, agentName }: MemoryViewerProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemories, setSelectedMemories] = useState<string[]>([]);
  const [confidenceFilter, setConfidenceFilter] = useState([0, 1]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('recent');

  useEffect(() => {
    loadMemories();
    loadStats();
  }, [agentId]);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/memories`);
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (error) {
      console.error('Error loading memories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/stats`);
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/memories?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (error) {
      console.error('Error searching memories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgetMemories = async () => {
    if (selectedMemories.length === 0) return;

    if (!confirm(`Are you sure you want to forget ${selectedMemories.length} memories?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentId}/memories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryIds: selectedMemories }),
      });

      if (response.ok) {
        setMemories(memories.filter(m => !selectedMemories.includes(m.id)));
        setSelectedMemories([]);
        loadStats();
        alert('Memories forgotten successfully');
      } else {
        alert('Error forgetting memories');
      }
    } catch (error) {
      console.error('Error forgetting memories:', error);
      alert('Error forgetting memories');
    }
  };

  const handleMemorySelect = (memoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedMemories([...selectedMemories, memoryId]);
    } else {
      setSelectedMemories(selectedMemories.filter(id => id !== memoryId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMemories(filteredMemories.map(m => m.id));
    } else {
      setSelectedMemories([]);
    }
  };

  const filteredMemories = memories.filter(memory => {
    const confidenceMatch = memory.confidence >= confidenceFilter[0] && memory.confidence <= confidenceFilter[1];
    return confidenceMatch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{agentName} - Memory Viewer</h2>
          <p className="text-gray-600">View and manage agent memories</p>
        </div>
        {selectedMemories.length > 0 && (
          <Button
            variant="danger"
            onClick={handleForgetMemories}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Forget {selectedMemories.length} Memories
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Eye className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Memories</p>
                  <p className="text-2xl font-bold">{stats.totalMemories}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Recent (7 days)</p>
                  <p className="text-2xl font-bold">{stats.recentMemories}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Eye className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">High Confidence</p>
                  <p className="text-2xl font-bold">{stats.highConfidenceMemories}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Search Memories
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by content, tags, or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>
          
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Confidence Filter: {confidenceFilter[0].toFixed(1)} - {confidenceFilter[1].toFixed(1)}
            </label>
            <Slider
              value={confidenceFilter}
              onValueChange={setConfidenceFilter}
              max={1}
              min={0}
              step={0.1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Memories List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Memories ({filteredMemories.length})</CardTitle>
              <CardDescription>
                {searchQuery ? `Search results for "${searchQuery}"` : 'All memories'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedMemories.length === filteredMemories.length && filteredMemories.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading memories...</p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="text-center py-8">
              <EyeOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No memories found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedMemories.includes(memory.id)}
                      onCheckedChange={(checked) => handleMemorySelect(memory.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {memory.sourceType}
                        </Badge>
                        <Badge className={`text-xs ${getConfidenceColor(memory.confidence)}`}>
                          Confidence: {(memory.confidence * 100).toFixed(0)}%
                        </Badge>
                        {memory.similarity && (
                          <Badge variant="secondary" className="text-xs">
                            Similarity: {(memory.similarity * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-gray-900 mb-2">{memory.content}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(memory.createdAt)}
                        </span>
                        {memory.sourceTitle && (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {memory.sourceTitle}
                          </span>
                        )}
                        {memory.tags.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {memory.tags.slice(0, 3).join(', ')}
                            {memory.tags.length > 3 && ` +${memory.tags.length - 3} more`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

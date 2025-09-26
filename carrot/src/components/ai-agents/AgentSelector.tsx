'use client';

import { useState, useEffect } from 'react';
import { Search, Brain, Users, Filter, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
}

interface AgentMatch {
  agent: Agent;
  score: number;
  reasons: string[];
  expertise: string[];
}

interface AgentSelectorProps {
  onAgentsSelected: (agents: Agent[]) => void;
  selectedAgents: Agent[];
  query?: string;
  context?: string;
  maxAgents?: number;
}

export default function AgentSelector({
  onAgentsSelected,
  selectedAgents,
  query = '',
  context = '',
  maxAgents = 3
}: AgentSelectorProps) {
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState(query);
  const [agentMatches, setAgentMatches] = useState<AgentMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');

  // Load all agents on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Auto-search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchAgents();
    } else {
      setAgentMatches([]);
    }
  }, [searchQuery]);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAllAgents(data.agents || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const searchAgents = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/agents/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          context,
          maxAgents: 10,
          operation: 'query'
        }),
      });

      const data = await response.json();
      setAgentMatches(data.agents || []);
    } catch (error) {
      console.error('Error searching agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgentToggle = (agent: Agent) => {
    const isSelected = selectedAgents.some(a => a.id === agent.id);
    
    if (isSelected) {
      // Remove agent
      onAgentsSelected(selectedAgents.filter(a => a.id !== agent.id));
    } else {
      // Add agent (if under limit)
      if (selectedAgents.length < maxAgents) {
        onAgentsSelected([...selectedAgents, agent]);
      }
    }
  };

  const handleExpertiseSearch = async (expertise: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agents/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: expertise,
          requiredExpertise: [expertise],
          maxAgents: 10,
          operation: 'expertise'
        }),
      });

      const data = await response.json();
      setAgentMatches(data.agents || []);
    } catch (error) {
      console.error('Error searching by expertise:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getExpertiseTags = () => {
    const allExpertise = new Set<string>();
    allAgents.forEach(agent => {
      agent.domainExpertise.forEach(expertise => allExpertise.add(expertise));
    });
    return Array.from(allExpertise).sort();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Select AI Agents</h3>
        <Badge variant="outline">
          {selectedAgents.length}/{maxAgents}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="expertise">Expertise</TabsTrigger>
          <TabsTrigger value="all">All Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search agents by name, expertise, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Searching agents...</p>
            </div>
          )}

          {agentMatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Search Results</h4>
              {agentMatches.map((match) => (
                <AgentCard
                  key={match.agent.id}
                  agent={match.agent}
                  match={match}
                  isSelected={selectedAgents.some(a => a.id === match.agent.id)}
                  onToggle={() => handleAgentToggle(match.agent)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expertise" className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">Browse by Expertise</h4>
            <div className="flex flex-wrap gap-2">
              {getExpertiseTags().map((expertise) => (
                <Button
                  key={expertise}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExpertiseSearch(expertise)}
                  className="text-xs"
                >
                  {expertise}
                </Button>
              ))}
            </div>
          </div>

          {agentMatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Expertise Results</h4>
              {agentMatches.map((match) => (
                <AgentCard
                  key={match.agent.id}
                  agent={match.agent}
                  match={match}
                  isSelected={selectedAgents.some(a => a.id === match.agent.id)}
                  onToggle={() => handleAgentToggle(match.agent)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">All Available Agents</h4>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {allAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgents.some(a => a.id === agent.id)}
                  onToggle={() => handleAgentToggle(agent)}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {selectedAgents.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700">Selected Agents</h4>
          <div className="flex flex-wrap gap-2">
            {selectedAgents.map((agent) => (
              <Badge key={agent.id} variant="secondary" className="flex items-center gap-1">
                {agent.name}
                <button
                  onClick={() => handleAgentToggle(agent)}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentCard({ 
  agent, 
  match, 
  isSelected, 
  onToggle 
}: { 
  agent: Agent; 
  match?: AgentMatch;
  isSelected: boolean; 
  onToggle: () => void;
}) {
  return (
    <Card className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'}`}>
      <CardContent className="p-3" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {agent.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h5 className="font-medium text-sm">{agent.name}</h5>
              <p className="text-xs text-gray-600">{agent.metadata.role || 'AI Agent'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {match && (
              <Badge variant="outline" className="text-xs">
                {(match.score * 100).toFixed(0)}% match
              </Badge>
            )}
            {isSelected ? (
              <Check className="w-4 h-4 text-blue-600" />
            ) : (
              <div className="w-4 h-4 border-2 border-gray-300 rounded" />
            )}
          </div>
        </div>
        
        {match && match.reasons.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-600">
              {match.reasons[0]}
            </p>
          </div>
        )}
        
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.domainExpertise.slice(0, 3).map((expertise) => (
            <Badge key={expertise} variant="secondary" className="text-xs">
              {expertise}
            </Badge>
          ))}
          {agent.domainExpertise.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{agent.domainExpertise.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

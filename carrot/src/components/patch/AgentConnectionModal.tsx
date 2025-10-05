'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Search, Calendar, FileText, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AgentConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (agentData: AgentData) => void;
}

interface AgentData {
  name: string;
  type: string;
  description: string;
  keywords: string[];
  frequency: string;
}

const agentTypes = [
  {
    id: 'news-monitor',
    name: 'News Monitor',
    description: 'Monitors news sources for relevant articles',
    icon: Globe,
    color: 'bg-blue-500'
  },
  {
    id: 'social-tracker',
    name: 'Social Tracker',
    description: 'Tracks social media mentions and discussions',
    icon: Search,
    color: 'bg-green-500'
  },
  {
    id: 'event-detector',
    name: 'Event Detector',
    description: 'Identifies and tracks important events',
    icon: Calendar,
    color: 'bg-orange-500'
  },
  {
    id: 'content-analyzer',
    name: 'Content Analyzer',
    description: 'Analyzes and summarizes content',
    icon: FileText,
    color: 'bg-purple-500'
  }
];

export default function AgentConnectionModal({ isOpen, onClose, onConnect }: AgentConnectionModalProps) {
  const [selectedType, setSelectedType] = useState('');
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [frequency, setFrequency] = useState('6');

  const selectedAgentType = agentTypes.find(type => type.id === selectedType);

  const handleConnect = () => {
    if (!selectedType) return;

    const agentData: AgentData = {
      name: customName || selectedAgentType?.name || 'Custom Agent',
      type: selectedType,
      description: description || selectedAgentType?.description || '',
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      frequency: frequency
    };

    onConnect(agentData);
    onClose();
    
    // Reset form
    setSelectedType('');
    setCustomName('');
    setDescription('');
    setKeywords('');
    setFrequency('6');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Connect an AI Agent
          </DialogTitle>
          <DialogDescription>
            Set up an AI agent to monitor this patch and automatically discover relevant content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent-type">Agent Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent type" />
              </SelectTrigger>
              <SelectContent>
                {agentTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${type.color} flex items-center justify-center`}>
                          <Icon className="w-2 h-2 text-white" />
                        </div>
                        <div>
                          <div className="font-medium">{type.name}</div>
                          <div className="text-xs text-gray-500">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Name */}
          <div className="space-y-2">
            <Label htmlFor="custom-name">Custom Name (Optional)</Label>
            <Input
              id="custom-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={selectedAgentType?.name || "Enter custom name"}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={selectedAgentType?.description || "Describe what this agent should monitor"}
              rows={3}
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (comma-separated)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="israel, palestine, middle east, conflict"
            />
          </div>

          {/* Update Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Update Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every hour</SelectItem>
                <SelectItem value="6">Every 6 hours</SelectItem>
                <SelectItem value="12">Every 12 hours</SelectItem>
                <SelectItem value="24">Daily</SelectItem>
                <SelectItem value="168">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={!selectedType}>
            Connect Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Brain, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  name: string;
  persona: string;
  domainExpertise: string[];
  metadata: {
    role?: string;
    expertise?: string[];
    avatar?: string;
  };
}

interface ChatMessage {
  id: string;
  type: 'agent' | 'deepseek' | 'system';
  content: string;
  timestamp: Date;
  knowledgeGaps?: string[];
  recommendations?: string[];
}

interface AgentSelfAssessmentChatProps {
  agent: Agent;
  onTopics?: (topics: string[]) => void; // emit parsed topics list for one-click learning
}

export default function AgentSelfAssessmentChat({ agent, onTopics }: AgentSelfAssessmentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with agent's self-assessment
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessage: ChatMessage = {
        id: '1',
        type: 'agent',
        content: `Hello! I'm ${agent.name}. I've been studying ${agent.domainExpertise.join(', ')}. Let me analyze what I know and identify areas where I need deeper knowledge.`,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      
      // Auto-trigger self-assessment
      setTimeout(() => {
        handleSelfAssessment();
      }, 1000);
    }
  }, [agent, messages.length]);

  // When switching to a different agent, reset chat state so we don't reuse the previous agent's context
  useEffect(() => {
    setMessages([]);
    setInputValue('');
    // The init effect above will fire on next render because messages.length === 0
  }, [agent.id]);

  const handleSelfAssessment = async () => {
    setIsLoading(true);
    
    try {
      // Get agent's current memories
      const memoriesResponse = await fetch(`/api/agents/${agent.id}/memories`);
      const memoriesData = await memoriesResponse.json();
      const memories = memoriesData.memories || [];

      // Create self-assessment prompt
      const assessmentPrompt = `You are ${agent.name}, an AI agent with expertise in ${agent.domainExpertise.join(', ')}. 

Your current knowledge includes:
${memories.map((m: any, i: number) => `${i + 1}. ${m.content?.substring(0, 200)}...`).join('\n')}

Please analyze your current knowledge and:
1. Identify specific areas where you need deeper expertise
2. Suggest concrete topics you should learn more about
3. Point out any knowledge gaps in your domain
4. Recommend specific resources or areas to explore

Be specific and actionable in your recommendations.`;

      const response = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are helping ${agent.name} assess their knowledge and identify learning opportunities. Be thorough and specific.`
            },
            {
              role: 'user',
              content: assessmentPrompt
            }
          ]
        })
      });

      const data = await response.json();
      
      if (data.success && data.response) {
        const deepseekMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'deepseek',
          content: data.response,
          timestamp: new Date(),
          knowledgeGaps: extractKnowledgeGaps(data.response),
          recommendations: extractRecommendations(data.response)
        };
        
        setMessages(prev => [...prev, deepseekMessage]);
        // Emit topics for one-click training
        try {
          const topics = extractTopicsList(data.response)
          if (topics.length && onTopics) onTopics(topics)
        } catch {}
      } else {
        throw new Error(data.error || 'Failed to get assessment');
      }
    } catch (error) {
      console.error('Error in self-assessment:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        content: 'I encountered an issue analyzing my knowledge. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractKnowledgeGaps = (content: string): string[] => {
    // Simple extraction of knowledge gaps from the response
    const gaps: string[] = [];
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.includes('need to learn') || line.includes('knowledge gap') || line.includes('should study')) {
        gaps.push(line.trim());
      }
    });
    
    return gaps.slice(0, 5); // Limit to 5 gaps
  };

  const extractRecommendations = (content: string): string[] => {
    // Simple extraction of recommendations from the response
    const recommendations: string[] = [];
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.includes('recommend') || line.includes('suggest') || line.includes('should explore')) {
        recommendations.push(line.trim());
      }
    });
    
    return recommendations.slice(0, 5); // Limit to 5 recommendations
  };

  const extractTopicsList = (content: string): string[] => {
    // Heuristics:
    // - Prefer a single comma-separated line with many items
    // - Also support bullets/numbered lists
    // - Normalize, dedupe, trim
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    let candidates: string[] = []
    // Find the longest comma-separated line
    const commaLines = lines.filter(l => l.split(',').length >= 3)
    if (commaLines.length) {
      const best = commaLines.sort((a,b)=> b.length - a.length)[0]
      candidates = best.split(',')
    } else {
      // Fallback: bullets or numbered
      for (const l of lines) {
        const m = l.match(/^(?:[-*•\d\.\)]\s*)?(.*)$/)
        if (m && m[1]) candidates.push(m[1])
      }
    }
    const cleaned = candidates
      .map(s => s.replace(/^[-*•\d\.\)]\s*/, ''))
      .map(s => s.replace(/[:;\-–—]+$/,'').trim())
      .map(s => s.replace(/\s+/g,' ').trim())
      .filter(Boolean)
      .map(s => s.length > 120 ? s.slice(0,120) : s)
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of cleaned) {
      const key = t.toLowerCase()
      if (!seen.has(key)) { seen.add(key); out.push(t) }
    }
    // Cap to reasonable batch size
    return out.slice(0, 50)
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'agent',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are ${agent.name}, an AI agent with expertise in ${agent.domainExpertise.join(', ')}. Help them identify learning opportunities and knowledge gaps.`
            },
            {
              role: 'user',
              content: inputValue
            }
          ]
        })
      });

      const data = await response.json();
      
      if (data.success && data.response) {
        const deepseekMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'deepseek',
          content: data.response,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, deepseekMessage]);
        // Emit topics for one-click training
        try {
          const topics = extractTopicsList(data.response)
          if (topics.length && onTopics) onTopics(topics)
        } catch {}
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Chat Messages */}
      <div className="max-h-96 overflow-y-auto space-y-3 p-4 bg-white rounded-lg border">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.type === 'agent' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.type === 'agent'
                  ? 'bg-blue-500 text-white'
                  : message.type === 'deepseek'
                  ? 'bg-green-100 text-green-900 border border-green-200'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {message.type === 'agent' ? (
                  <Brain className="w-4 h-4" />
                ) : message.type === 'deepseek' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-xs font-medium">
                  {message.type === 'agent' ? agent.name : message.type === 'deepseek' ? 'DeepSeek Assessment' : 'System'}
                </span>
              </div>
              
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              
              {/* Knowledge Gaps */}
              {message.knowledgeGaps && message.knowledgeGaps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs font-medium text-green-800 mb-2">Knowledge Gaps Identified:</p>
                  <div className="flex flex-wrap gap-1">
                    {message.knowledgeGaps.map((gap, index) => (
                      <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recommendations */}
              {message.recommendations && message.recommendations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs font-medium text-green-800 mb-2">Learning Recommendations:</p>
                  <div className="flex flex-wrap gap-1">
                    {message.recommendations.map((rec, index) => (
                      <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {rec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm text-gray-600">Analyzing knowledge...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Ask ${agent.name} about their knowledge gaps or learning needs...`}
          className="flex-1 min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
          className="px-4"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSelfAssessment}
          disabled={isLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Brain className="w-4 h-4" />
          Re-assess Knowledge
        </Button>
        <Button
          onClick={() => setMessages([])}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Clear Chat
        </Button>
      </div>
    </div>
  );
}

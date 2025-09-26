'use client';

import React, { useState, useEffect } from 'react';
import { X, Upload, Link, FileText, Users, Zap, CheckCircle, AlertCircle } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  domainExpertise: string[];
  persona: string;
}

interface BatchFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
}

export default function BatchFeedModal({ isOpen, onClose, agents }: BatchFeedModalProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [feedType, setFeedType] = useState<'url' | 'text' | 'file'>('url');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Auto-select all agents by default
  useEffect(() => {
    if (isOpen && agents.length > 0) {
      setSelectedAgents(agents.map(agent => agent.id));
    }
  }, [isOpen, agents]);

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAgents(agents.map(agent => agent.id));
  };

  const handleSelectNone = () => {
    setSelectedAgents([]);
  };

  const handleBatchFeed = async () => {
    if (selectedAgents.length === 0 || !content.trim()) {
      alert('Please select agents and provide content');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setShowResults(false);

    try {
      const feedItem = {
        content: content.trim(),
        sourceType: feedType,
        sourceUrl: feedType === 'url' ? content.trim() : undefined,
        sourceTitle: feedType === 'url' ? 'Batch Feed Content' : 'Manual Content',
        tags: []
      };

      const response = await fetch('/api/agents/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'feed',
          agentIds: selectedAgents,
          feedItem
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResults(data.results || []);
        setShowResults(true);
        setContent(''); // Clear form after successful feed
      } else {
        throw new Error(data.error || 'Failed to feed agents');
      }
    } catch (error) {
      console.error('Batch feed error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Batch Feed Agents</h2>
            <p className="text-gray-600 mt-1">Feed content to multiple agents at once</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!showResults ? (
            <>
              {/* Agent Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Agents</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleSelectNone}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Select None
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {agents.map((agent) => (
                    <label key={agent.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(agent.id)}
                        onChange={() => handleAgentToggle(agent.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-600">{agent.domainExpertise.slice(0, 2).join(', ')}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {selectedAgents.length} of {agents.length} agents selected
                </p>
              </div>

              {/* Content Input */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Content to Feed</h3>
                
                {/* Feed Type Selection */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setFeedType('url')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      feedType === 'url' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Link className="w-4 h-4" />
                    URL
                  </button>
                  <button
                    onClick={() => setFeedType('text')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      feedType === 'text' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Text
                  </button>
                </div>

                {/* Content Input */}
                {feedType === 'url' ? (
                  <input
                    type="url"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter URL to feed to agents (e.g., https://example.com/article)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter text content to feed to agents..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBatchFeed}
                  disabled={isLoading || selectedAgents.length === 0 || !content.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Feeding...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Feed to {selectedAgents.length} Agents
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* Results View */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Feed Results</h3>
              </div>
              
              <div className="space-y-3 mb-6">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{result.agentName}</div>
                      <div className="text-sm text-gray-600">
                        {result.success ? `Fed successfully (${result.memoriesCreated} memories)` : result.error}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResults(false);
                    setResults([]);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Feed More Content
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle, BookOpen, Calendar, User, Brain } from 'lucide-react';

interface TrainingRecord {
  id: string;
  agentId: string;
  agentName: string;
  workflowName: string;
  workflowType: string;
  steps: TrainingStep[];
  startedAt: string;
  completedAt?: string;
  status: 'completed' | 'in_progress' | 'failed';
  successRate: number;
}

interface TrainingStep {
  name: string;
  content: string;
  sourceType: string;
  sourceTitle: string;
  completed: boolean;
  success: boolean;
  completedAt?: string;
}

interface Agent {
  id: string;
  name: string;
  domainExpertise: string[];
  persona: string;
}

interface TrainingTrackerProps {
  agents: Agent[];
}

export default function TrainingTracker({ agents }: TrainingTrackerProps) {
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrainingRecords();
  }, []);

  const loadTrainingRecords = async () => {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll simulate with localStorage or create mock data
      const stored = localStorage.getItem('agent-training-records');
      if (stored) {
        setTrainingRecords(JSON.parse(stored));
      } else {
        // Create mock training records for demonstration
        const mockRecords: TrainingRecord[] = [
          {
            id: 'training-1',
            agentId: 'agent-einstein',
            agentName: 'Albert Einstein',
            workflowName: 'Physics Mastery Program',
            workflowType: 'physics',
            steps: [
              { name: 'Physics Fundamentals', content: 'https://en.wikipedia.org/wiki/Physics', sourceType: 'url', sourceTitle: 'Physics - Wikipedia', completed: true, success: true, completedAt: '2024-01-15T10:30:00Z' },
              { name: 'Quantum Mechanics', content: 'https://en.wikipedia.org/wiki/Quantum_mechanics', sourceType: 'url', sourceTitle: 'Quantum Mechanics - Wikipedia', completed: true, success: true, completedAt: '2024-01-15T10:35:00Z' },
              { name: 'Theory of Relativity', content: 'https://en.wikipedia.org/wiki/Theory_of_relativity', sourceType: 'url', sourceTitle: 'Theory of Relativity - Wikipedia', completed: true, success: true, completedAt: '2024-01-15T10:40:00Z' },
              { name: 'Modern Physics', content: 'https://en.wikipedia.org/wiki/Modern_physics', sourceType: 'url', sourceTitle: 'Modern Physics - Wikipedia', completed: true, success: true, completedAt: '2024-01-15T10:45:00Z' },
              { name: 'Particle Physics', content: 'https://en.wikipedia.org/wiki/Particle_physics', sourceType: 'url', sourceTitle: 'Particle Physics - Wikipedia', completed: true, success: true, completedAt: '2024-01-15T10:50:00Z' }
            ],
            startedAt: '2024-01-15T10:30:00Z',
            completedAt: '2024-01-15T10:50:00Z',
            status: 'completed',
            successRate: 100
          },
          {
            id: 'training-2',
            agentId: 'agent-keynes',
            agentName: 'John Maynard Keynes',
            workflowName: 'Economics Mastery Program',
            workflowType: 'economics',
            steps: [
              { name: 'Economic Theory', content: 'https://en.wikipedia.org/wiki/Economics', sourceType: 'url', sourceTitle: 'Economics - Wikipedia', completed: true, success: true, completedAt: '2024-01-16T09:00:00Z' },
              { name: 'Microeconomics', content: 'https://en.wikipedia.org/wiki/Microeconomics', sourceType: 'url', sourceTitle: 'Microeconomics - Wikipedia', completed: true, success: true, completedAt: '2024-01-16T09:05:00Z' },
              { name: 'Macroeconomics', content: 'https://en.wikipedia.org/wiki/Macroeconomics', sourceType: 'url', sourceTitle: 'Macroeconomics - Wikipedia', completed: true, success: true, completedAt: '2024-01-16T09:10:00Z' },
              { name: 'Keynesian Economics', content: 'https://en.wikipedia.org/wiki/Keynesian_economics', sourceType: 'url', sourceTitle: 'Keynesian Economics - Wikipedia', completed: true, success: true, completedAt: '2024-01-16T09:15:00Z' },
              { name: 'Fiscal Policy', content: 'https://en.wikipedia.org/wiki/Fiscal_policy', sourceType: 'url', sourceTitle: 'Fiscal Policy - Wikipedia', completed: true, success: true, completedAt: '2024-01-16T09:20:00Z' }
            ],
            startedAt: '2024-01-16T09:00:00Z',
            completedAt: '2024-01-16T09:20:00Z',
            status: 'completed',
            successRate: 100
          },
          {
            id: 'training-3',
            agentId: 'agent-mlk',
            agentName: 'Martin Luther King Jr.',
            workflowName: 'History Mastery Program',
            workflowType: 'history',
            steps: [
              { name: 'World History Overview', content: 'https://en.wikipedia.org/wiki/History', sourceType: 'url', sourceTitle: 'History - Wikipedia', completed: true, success: true, completedAt: '2024-01-17T14:00:00Z' },
              { name: 'Ancient Civilizations', content: 'https://en.wikipedia.org/wiki/Ancient_history', sourceType: 'url', sourceTitle: 'Ancient History - Wikipedia', completed: true, success: true, completedAt: '2024-01-17T14:05:00Z' },
              { name: 'Medieval Period', content: 'https://en.wikipedia.org/wiki/Middle_Ages', sourceType: 'url', sourceTitle: 'Middle Ages - Wikipedia', completed: true, success: true, completedAt: '2024-01-17T14:10:00Z' },
              { name: 'Modern History', content: 'https://en.wikipedia.org/wiki/Modern_history', sourceType: 'url', sourceTitle: 'Modern History - Wikipedia', completed: true, success: true, completedAt: '2024-01-17T14:15:00Z' },
              { name: 'Contemporary History', content: 'https://en.wikipedia.org/wiki/Contemporary_history', sourceType: 'url', sourceTitle: 'Contemporary History - Wikipedia', completed: true, success: true, completedAt: '2024-01-17T14:20:00Z' }
            ],
            startedAt: '2024-01-17T14:00:00Z',
            completedAt: '2024-01-17T14:20:00Z',
            status: 'completed',
            successRate: 100
          }
        ];
        setTrainingRecords(mockRecords);
        localStorage.setItem('agent-training-records', JSON.stringify(mockRecords));
      }
    } catch (error) {
      console.error('Error loading training records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = selectedAgent === 'all' 
    ? trainingRecords 
    : trainingRecords.filter(record => record.agentId === selectedAgent);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Training Tracker</h2>
          <p className="text-gray-600 mt-1">Track what each agent has been trained on</p>
        </div>
        
        {/* Agent Filter */}
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="all">All Agents</option>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
      </div>

      {/* Training Records */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Records</h3>
            <p className="text-gray-600">Start training agents to see their progress here.</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(record.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{record.workflowName}</h3>
                    <p className="text-sm text-gray-600">Trained: {record.agentName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                    {record.status.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-500">
                    {record.successRate}% success
                  </span>
                </div>
              </div>

              {/* Training Steps */}
              <div className="space-y-2 mb-4">
                {record.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    {step.completed ? (
                      step.success ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{step.name}</div>
                      <div className="text-xs text-gray-500">{step.sourceTitle}</div>
                    </div>
                    {step.completedAt && (
                      <div className="text-xs text-gray-500">
                        {new Date(step.completedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Training Metadata */}
              <div className="flex items-center gap-4 text-sm text-gray-500 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Started: {new Date(record.startedAt).toLocaleDateString()}</span>
                </div>
                {record.completedAt && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Completed: {new Date(record.completedAt).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Brain className="w-4 h-4" />
                  <span>{record.steps.length} training steps</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {filteredRecords.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Training Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredRecords.length}
              </div>
              <div className="text-sm text-gray-600">Total Training Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredRecords.filter(r => r.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {Math.round(filteredRecords.reduce((acc, r) => acc + r.successRate, 0) / filteredRecords.length)}%
              </div>
              <div className="text-sm text-gray-600">Average Success Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle, AlertCircle, Clock, BookOpen, Link, FileText, X } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  domainExpertise: string[];
  persona: string;
}

interface TrainingStep {
  id: string;
  name: string;
  description: string;
  content: string;
  sourceType: 'url' | 'text' | 'file';
  sourceUrl?: string;
  sourceTitle?: string;
  order: number;
  completed: boolean;
  success?: boolean;
  error?: string;
}

interface TrainingWorkflow {
  id: string;
  name: string;
  description: string;
  agentId: string;
  agentName: string;
  steps: TrainingStep[];
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
}

interface AgentTrainingWorkflowProps {
  agent: Agent;
  onClose: () => void;
}

export default function AgentTrainingWorkflow({ agent, onClose }: AgentTrainingWorkflowProps) {
  const [workflow, setWorkflow] = useState<TrainingWorkflow | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isRunning, setIsRunning] = useState(false);

  // Predefined training workflows for different agent types
  const getTrainingWorkflow = (agent: Agent): TrainingWorkflow => {
    console.log('getTrainingWorkflow called with agent:', {
      id: agent.id,
      name: agent.name,
      domainExpertise: agent.domainExpertise
    });
    
    const baseWorkflow = {
      id: `workflow-${agent.id}`,
      name: `${agent.name} Training Program`,
      description: `Comprehensive training program for ${agent.name}`,
      agentId: agent.id,
      agentName: agent.name,
      isRunning: false,
      currentStep: 0,
      totalSteps: 0,
      completedSteps: 0,
      steps: [] as TrainingStep[]
    };

    // Customize training based on agent expertise
    const hasPhysics = agent.domainExpertise.some(exp => exp.toLowerCase().includes('physics'));
    console.log('Physics check:', { hasPhysics, domainExpertise: agent.domainExpertise });
    
    if (hasPhysics) {
      return {
        ...baseWorkflow,
        steps: [
          {
            id: 'physics-fundamentals',
            name: 'Physics Fundamentals',
            description: 'Core physics concepts and principles',
            content: 'https://en.wikipedia.org/wiki/Physics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Physics',
            sourceTitle: 'Physics - Wikipedia',
            order: 1,
            completed: false
          },
          {
            id: 'quantum-mechanics',
            name: 'Quantum Mechanics',
            description: 'Quantum theory and applications',
            content: 'https://en.wikipedia.org/wiki/Quantum_mechanics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Quantum_mechanics',
            sourceTitle: 'Quantum Mechanics - Wikipedia',
            order: 2,
            completed: false
          },
          {
            id: 'relativity',
            name: 'Theory of Relativity',
            description: 'Special and general relativity',
            content: 'https://en.wikipedia.org/wiki/Theory_of_relativity',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Theory_of_relativity',
            sourceTitle: 'Theory of Relativity - Wikipedia',
            order: 3,
            completed: false
          },
          {
            id: 'modern-physics',
            name: 'Modern Physics',
            description: 'Contemporary physics research and discoveries',
            content: 'https://en.wikipedia.org/wiki/Modern_physics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Modern_physics',
            sourceTitle: 'Modern Physics - Wikipedia',
            order: 4,
            completed: false
          }
        ]
      };
    }

    const hasEconomics = agent.domainExpertise.some(exp => exp.toLowerCase().includes('economics'));
    console.log('Economics check:', { hasEconomics });
    
    if (hasEconomics) {
      return {
        ...baseWorkflow,
        steps: [
          {
            id: 'economic-theory',
            name: 'Economic Theory',
            description: 'Fundamental economic principles',
            content: 'https://en.wikipedia.org/wiki/Economics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Economics',
            sourceTitle: 'Economics - Wikipedia',
            order: 1,
            completed: false
          },
          {
            id: 'macroeconomics',
            name: 'Macroeconomics',
            description: 'National and global economic systems',
            content: 'https://en.wikipedia.org/wiki/Macroeconomics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Macroeconomics',
            sourceTitle: 'Macroeconomics - Wikipedia',
            order: 2,
            completed: false
          },
          {
            id: 'keynesian-economics',
            name: 'Keynesian Economics',
            description: 'Keynesian economic theory and policy',
            content: 'https://en.wikipedia.org/wiki/Keynesian_economics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Keynesian_economics',
            sourceTitle: 'Keynesian Economics - Wikipedia',
            order: 3,
            completed: false
          },
          {
            id: 'fiscal-policy',
            name: 'Fiscal Policy',
            description: 'Government spending and taxation',
            content: 'https://en.wikipedia.org/wiki/Fiscal_policy',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Fiscal_policy',
            sourceTitle: 'Fiscal Policy - Wikipedia',
            order: 4,
            completed: false
          }
        ]
      };
    }

    const hasMathematics = agent.domainExpertise.some(exp => exp.toLowerCase().includes('mathematics'));
    console.log('Mathematics check:', { hasMathematics });
    
    if (hasMathematics) {
      return {
        ...baseWorkflow,
        steps: [
          {
            id: 'mathematical-foundations',
            name: 'Mathematical Foundations',
            description: 'Core mathematical concepts',
            content: 'https://en.wikipedia.org/wiki/Mathematics',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Mathematics',
            sourceTitle: 'Mathematics - Wikipedia',
            order: 1,
            completed: false
          },
          {
            id: 'algorithms',
            name: 'Algorithms',
            description: 'Algorithmic thinking and design',
            content: 'https://en.wikipedia.org/wiki/Algorithm',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Algorithm',
            sourceTitle: 'Algorithm - Wikipedia',
            order: 2,
            completed: false
          },
          {
            id: 'computer-programming',
            name: 'Computer Programming',
            description: 'Programming concepts and languages',
            content: 'https://en.wikipedia.org/wiki/Computer_programming',
            sourceType: 'url',
            sourceUrl: 'https://en.wikipedia.org/wiki/Computer_programming',
            sourceTitle: 'Computer Programming - Wikipedia',
            order: 3,
            completed: false
          }
        ]
      };
    }

    // Default general knowledge workflow
    console.log('Using default general knowledge workflow');
    return {
      ...baseWorkflow,
      steps: [
        {
          id: 'general-knowledge',
          name: 'General Knowledge',
          description: 'Broad knowledge base',
          content: 'https://en.wikipedia.org/wiki/Knowledge',
          sourceType: 'url',
          sourceUrl: 'https://en.wikipedia.org/wiki/Knowledge',
          sourceTitle: 'Knowledge - Wikipedia',
          order: 1,
          completed: false
        },
        {
          id: 'critical-thinking',
          name: 'Critical Thinking',
          description: 'Analytical and reasoning skills',
          content: 'https://en.wikipedia.org/wiki/Critical_thinking',
          sourceType: 'url',
          sourceUrl: 'https://en.wikipedia.org/wiki/Critical_thinking',
          sourceTitle: 'Critical Thinking - Wikipedia',
          order: 2,
          completed: false
        }
      ]
    };
  };

  useEffect(() => {
    if (agent) {
      console.log('Creating training workflow for agent:', {
        id: agent.id,
        name: agent.name,
        domainExpertise: agent.domainExpertise
      });
      
      try {
        const trainingWorkflow = getTrainingWorkflow(agent);
        console.log('Generated training workflow:', {
          id: trainingWorkflow.id,
          name: trainingWorkflow.name,
          stepsCount: trainingWorkflow.steps.length,
          steps: trainingWorkflow.steps.map(s => ({ id: s.id, name: s.name }))
        });
        
        setWorkflow({
          ...trainingWorkflow,
          totalSteps: trainingWorkflow.steps.length
        });
        setIsLoading(false); // Set loading to false after workflow is created
      } catch (error) {
        console.error('Error creating training workflow:', error);
        // Set a safe default workflow
        setWorkflow({
          id: `workflow-${agent.id}`,
          name: `${agent.name} Training Program`,
          description: `Comprehensive training program for ${agent.name}`,
          agentId: agent.id,
          agentName: agent.name,
          isRunning: false,
          currentStep: 0,
          totalSteps: 0,
          completedSteps: 0,
          steps: []
        });
        setIsLoading(false); // Set loading to false even on error
      }
    } else {
      setIsLoading(false); // Set loading to false if no agent
    }
  }, [agent]);

  const executeStep = async (step: TrainingStep) => {
    try {
      // Validate step data
      if (!step || !step.content || !step.sourceType) {
        return { success: false, error: 'Invalid step data' };
      }

      const feedItem = {
        content: step.content,
        sourceType: step.sourceType,
        sourceUrl: step.sourceUrl || undefined,
        sourceTitle: step.sourceTitle || step.name || 'Unknown Source',
        sourceAuthor: 'Training System',
        tags: []
      };

      const response = await fetch('/api/agents/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'feed',
          agentIds: [agent.id],
          feedItem
        }),
      });

      if (!response.ok) {
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }

      const data = await response.json();
      
      // Handle mock responses when AI training is disabled
      if (data.results?.mockResults || data.results?.mockResult) {
        return { 
          success: false, 
          error: data.results.message || 'AI training is disabled on this server' 
        };
      }
      
      if (response.ok && data.results && data.results[0]?.success) {
        return { success: true, memoriesCreated: data.results[0].memoriesCreated };
      } else {
        return { 
          success: false, 
          error: data.results?.[0]?.error || data.error || 'Unknown error' 
        };
      }
    } catch (error) {
      console.error('Error executing training step:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const runWorkflow = async () => {
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      console.error('Cannot run workflow: invalid workflow or no steps');
      return;
    }

    try {
      setIsRunning(true);
      setWorkflow(prev => prev ? { ...prev, isRunning: true, currentStep: 0 } : null);

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        if (!step) {
          console.error(`Invalid step at index ${i}`);
          continue;
        }
        
        // Update current step
        setWorkflow(prev => prev ? { 
          ...prev, 
          currentStep: i + 1 
        } : null);

        // Execute step
        const result = await executeStep(step);

        // Update step result
        setWorkflow(prev => {
          if (!prev || !prev.steps) return null;
          const updatedSteps = [...prev.steps];
          if (updatedSteps[i]) {
            updatedSteps[i] = {
              ...updatedSteps[i],
              completed: true,
              success: result.success,
              error: result.error
            };
          }
          
          return {
            ...prev,
            steps: updatedSteps,
            completedSteps: updatedSteps.filter(s => s && s.completed).length
          };
        });

        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
      setWorkflow(prev => prev ? { ...prev, isRunning: false } : null);
    }
  };

  const resetWorkflow = () => {
    if (!workflow) return;
    
    const resetSteps = workflow.steps.map(step => ({
      ...step,
      completed: false,
      success: undefined,
      error: undefined
    }));

    setWorkflow({
      ...workflow,
      steps: resetSteps,
      currentStep: 0,
      completedSteps: 0,
      isRunning: false
    });
  };

  // Show loading state while workflow is being created
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Training Program</h2>
              <p className="text-gray-600">Preparing {agent?.name}'s training workflow...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!workflow || !workflow.steps) {
    console.log('AgentTrainingWorkflow: No workflow or steps available after loading');
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Training Available</h2>
              <p className="text-gray-600 mb-4">No training steps could be generated for this agent.</p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Additional safety check
  if (!Array.isArray(workflow.steps)) {
    console.error('AgentTrainingWorkflow: workflow.steps is not an array', workflow.steps);
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Training Data</h2>
              <p className="text-gray-600 mb-4">The training workflow data is invalid.</p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{workflow.name}</h2>
            <p className="text-gray-600 mt-1">{workflow.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Progress Overview */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">
                {workflow.completedSteps} of {workflow.totalSteps} steps completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(workflow.completedSteps / workflow.totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Training Steps */}
          <div className="space-y-4 mb-6">
            {workflow.steps && workflow.steps.length > 0 ? workflow.steps.map((step, index) => (
              <div 
                key={step.id} 
                className={`p-4 rounded-lg border-2 transition-all ${
                  step.completed 
                    ? step.success 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-red-200 bg-red-50'
                    : workflow.currentStep === index + 1
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed 
                      ? step.success 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                      : workflow.currentStep === index + 1
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                  }`}>
                    {step.completed ? (
                      step.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )
                    ) : workflow.currentStep === index + 1 ? (
                      <Clock className="w-5 h-5 text-blue-600" />
                    ) : (
                      <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{step.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {step.sourceType === 'url' && <Link className="w-3 h-3" />}
                      {step.sourceType === 'text' && <FileText className="w-3 h-3" />}
                      {step.sourceType === 'file' && <BookOpen className="w-3 h-3" />}
                      <span>{step.sourceTitle}</span>
                    </div>

                    {step.error && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {step.error}
                      </div>
                    )}

                    {step.success && (
                      <div className="mt-2 text-sm text-green-600">
                        ✓ Successfully fed to agent
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500">
                <p>No training steps available for this agent.</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!workflow.isRunning ? (
              <>
                <button
                  onClick={runWorkflow}
                  disabled={workflow.completedSteps === workflow.totalSteps}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {workflow.completedSteps === 0 ? 'Start Training' : 'Resume Training'}
                </button>
                
                {workflow.completedSteps > 0 && (
                  <button
                    onClick={resetWorkflow}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                )}
              </>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg opacity-75 cursor-not-allowed"
              >
                <Clock className="w-4 h-4 animate-spin" />
                Training in Progress...
              </button>
            )}
            
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

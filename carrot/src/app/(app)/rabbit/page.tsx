'use client';

import { useState, useRef } from 'react';
import { Upload, Play, Pause, Download, Sparkles, Users, Plus, Search, Filter } from 'lucide-react';
import MediaUploadCard from '../../../components/rabbit/MediaUploadCard';
import CreationTools from '../../../components/rabbit/CreationTools';

const FEATURED_AGENTS = [
  {
    id: 'alan-turing',
    name: 'Alan Turing',
    avatar: '/agents/Alan Turing.png',
    domains: ['Computer Science', 'Mathematics', 'Logic'],
    strengths: ['Complex problem solving', 'Mathematical proofs', 'Code optimization'],
    limits: ['Modern web frameworks', 'Social media trends'],
    samplePrompts: ['Optimize this algorithm', 'Explain computational complexity', 'Debug logical errors']
  },
  {
    id: 'albert-einstein',
    name: 'Albert Einstein',
    avatar: '/agents/Albert Einstein.png',
    domains: ['Physics', 'Science', 'Philosophy'],
    strengths: ['Scientific explanations', 'Thought experiments', 'Complex theories'],
    limits: ['Modern technology', 'Pop culture'],
    samplePrompts: ['Explain this concept simply', 'What are the implications?', 'Design a thought experiment']
  },
  {
    id: 'benjamin-graham',
    name: 'Benjamin Graham',
    avatar: '/agents/Benjamin Graham.png',
    domains: ['Finance', 'Investment', 'Economics'],
    strengths: ['Value investing', 'Risk analysis', 'Market fundamentals'],
    limits: ['Cryptocurrency', 'Social media marketing'],
    samplePrompts: ['Analyze this investment', 'What are the risks?', 'Value this company']
  },
  {
    id: 'charles-darwin',
    name: 'Charles Darwin',
    avatar: '/agents/Charles Darwin.png',
    domains: ['Biology', 'Evolution', 'Natural Science'],
    strengths: ['Scientific observation', 'Pattern recognition', 'Research methodology'],
    limits: ['Modern genetics', 'Digital technology'],
    samplePrompts: ['Observe patterns in data', 'Explain this phenomenon', 'Design an experiment']
  },
  {
    id: 'edward-murrow',
    name: 'Edward Murrow',
    avatar: '/agents/Edward Murrow.png',
    domains: ['Journalism', 'Broadcasting', 'Communication'],
    strengths: ['Clear storytelling', 'Fact-checking', 'Interview techniques'],
    limits: ['Social media', 'Modern tech platforms'],
    samplePrompts: ['Write a compelling lead', 'Structure this story', 'Fact-check this claim']
  },
  {
    id: 'jfk',
    name: 'JFK',
    avatar: '/agents/JFK.png',
    domains: ['Leadership', 'Politics', 'Public Speaking'],
    strengths: ['Inspiring speeches', 'Crisis management', 'Vision articulation'],
    limits: ['Modern social media', 'Tech policy'],
    samplePrompts: ['Write an inspiring message', 'Handle this crisis', 'Motivate the team']
  },
  {
    id: 'mark-twain',
    name: 'Mark Twain',
    avatar: '/agents/Mark Twain.png',
    domains: ['Writing', 'Humor', 'Storytelling'],
    strengths: ['Witty commentary', 'Character development', 'Social observation'],
    limits: ['Modern slang', 'Digital platforms'],
    samplePrompts: ['Add humor to this', 'Develop this character', 'Write engaging dialogue']
  },
  {
    id: 'mlk',
    name: 'MLK',
    avatar: '/agents/MLK.png',
    domains: ['Civil Rights', 'Leadership', 'Social Justice'],
    strengths: ['Powerful speeches', 'Moral clarity', 'Movement building'],
    limits: ['Modern activism tactics', 'Digital organizing'],
    samplePrompts: ['Write a call to action', 'Address injustice', 'Unite different groups']
  }
];

type MediaType = 'video' | 'image' | null;
type CreationMode = 'overlay' | 'frame' | 'meme' | null;
type Agent = typeof FEATURED_AGENTS[0];

const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF',
  ink: '#0B0B0F',
  surface: '#FFFFFF',
  slate: '#64748B'
};

const AGENT_CATEGORIES = [
  {
    id: 'qa-audit',
    title: ' QA & Audit',
    agents: [
      {
        id: 'design-guardian',
        name: 'Design Guardian',
        role: 'Enforcer',
        avatar: '/agents/design-guardian.png',
        skills: [' Audit', ' Actions', ' Metrics'],
        actions: [
          { label: 'Run Audit', icon: Play, primary: true },
          { label: 'Check Contrast', icon: Eye },
          { label: 'Scan A11Y', icon: CheckCircle }
        ],
        status: 'online'
      },
      {
        id: 'a11y-auditor',
        name: 'A11Y Auditor',
        role: 'Accessibility Specialist',
        avatar: '/agents/a11y-auditor.png',
        skills: [' A11Y', ' WCAG', ' Scan'],
        actions: [
          { label: 'Audit Page', icon: Play, primary: true },
          { label: 'Check ARIA', icon: CheckCircle },
          { label: 'Test Navigation', icon: Eye }
        ],
        status: 'online'
      }
    ]
  },
  {
    id: 'build-spec',
    title: ' Build & Spec',
    agents: [
      {
        id: 'spec-generator',
        name: 'Spec Generator',
        role: 'System Builder',
        avatar: '/agents/spec-generator.png',
        skills: [' Spec', ' Tokens', ' Layout'],
        actions: [
          { label: 'Generate Spec', icon: Zap, primary: true },
          { label: 'Create Tokens', icon: Settings },
          { label: 'Export CSS', icon: Eye }
        ],
        status: 'busy'
      },
      {
        id: 'layout-inspector',
        name: 'Layout Inspector',
        role: 'Grid & Spacing Checker',
        avatar: '/agents/layout-inspector.png',
        skills: [' Grid', ' Spacing', ' Alignment'],
        actions: [
          { label: 'Check Grid', icon: Play, primary: true },
          { label: 'Measure Spacing', icon: Eye },
          { label: 'Validate Layout', icon: CheckCircle }
        ],
        status: 'online'
      }
    ]
  },
  {
    id: 'reviewers',
    title: ' Reviewers',
    agents: [
      {
        id: 'typographer',
        name: 'Typographer',
        role: 'Type & Readability Agent',
        avatar: '/agents/typographer.png',
        skills: [' Type', ' Readability', ' Contrast'],
        actions: [
          { label: 'Review Type', icon: Eye, primary: true },
          { label: 'Check Readability', icon: CheckCircle },
          { label: 'Test Contrast', icon: AlertTriangle }
        ],
        status: 'online'
      },
      {
        id: 'motion-moderator',
        name: 'Motion Moderator',
        role: 'Microinteractions Review',
        avatar: '/agents/motion-moderator.png',
        skills: [' Motion', ' Duration', ' Easing'],
        actions: [
          { label: 'Review Motion', icon: Play, primary: true },
          { label: 'Check Duration', icon: Eye },
          { label: 'Test Interactions', icon: Zap }
        ],
        status: 'offline'
      }
    ]
  }
];

function getStatusColor(status: string) {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'busy': return 'bg-orange-500';
    case 'offline': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
};

function getStatusText(status: string) {
  switch (status) {
    case 'online': return 'Available';
    case 'busy': return 'Busy';
    case 'offline': return 'Offline';
    default: return 'Unknown';
  }
};

function AgentTile({ agent }: { agent: any }) {
  return (
    <div className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-blue-500/20 hover:shadow-blue-500/10 p-6 min-w-[300px] max-w-[300px]">
      <div className="flex flex-col items-center text-center">
        {/* Avatar with status indicator */}
        <div className="relative mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {agent.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          {/* Status indicator */}
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${getStatusColor(agent.status)} rounded-full border-2 border-white flex items-center justify-center`}>
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
        
        {/* Agent info */}
        <h3 className="font-semibold text-gray-900 mb-1 text-lg">{agent.name}</h3>
        <p className="text-sm text-gray-600 mb-2">{agent.role}</p>
        <p className="text-xs text-gray-500 mb-4">{getStatusText(agent.status)}</p>
        
        {/* Skills badges */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {agent.skills.map((skill: string, index: number) => (
            <span
              key={index}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200 hover:border-blue-300 transition-colors"
            >
              {skill}
            </span>
          ))}
        </div>
        
        {/* Quick actions */}
        <div className="flex flex-col gap-2 w-full">
          {agent.actions.slice(0, 2).map((action: any, index: number) => {
            const IconComponent = action.icon;
            return (
              <button
                key={index}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 min-h-[44px] ${
                  action.primary
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900'
                }`}
              >
                <IconComponent size={16} />
                {action.label}
              </button>
            );
          })}
          
          {/* Chat button */}
          <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors min-h-[44px] border border-blue-200 hover:border-blue-300">
            <MessageSquare size={16} />
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentRow({ category }: { category: any }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 px-6">{category.title}</h2>
      <div className="flex gap-6 overflow-x-auto px-6 pb-4">
        {category.agents.map((agent: any) => (
          <AgentTile key={agent.id} agent={agent} />
        ))}
        
        {/* Add new agent tile */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 min-w-[300px] max-w-[300px] flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 cursor-pointer group">
          <div className="w-20 h-20 bg-gray-200 group-hover:bg-blue-200 rounded-xl mb-4 flex items-center justify-center transition-colors">
            <span className="text-3xl text-gray-400 group-hover:text-blue-500 transition-colors">+</span>
          </div>
          <p className="text-gray-600 font-medium mb-2">Create New Agent</p>
          <p className="text-sm text-gray-500">Custom specialist for your workflow</p>
        </div>
      </div>
    </div>
  );
}

export default function RabbitAIPage() {
  // State management
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'video' | 'image' } | null>(null);
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentQuery, setAgentQuery] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      setSelectedMedia({ url, type });
      
      // Auto-transcribe if video
      if (type === 'video') {
        setIsProcessing(true);
        // Simulate transcription
        setTimeout(() => {
          setTranscript('This is a sample transcript of the uploaded video content...');
          setIsProcessing(false);
        }, 2000);
      }
    }
  };

  const handleAgentQuery = async (query: string) => {
    if (!selectedAgent || !query.trim()) return;
    
    setIsProcessing(true);
    // Simulate agent response
    setTimeout(() => {
      // This would integrate with your AI backend
      console.log(`${selectedAgent.name} responding to: ${query}`);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Rabbit AI</h1>
            </div>
            <div className="text-sm text-gray-500">
              Create with AI • Work with Experts
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
          
          {/* Left Panel - Create with AI */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Media Upload */}
              <MediaUploadCard
                onMediaSelect={(media: { url: string; type: 'video' | 'image' }) => {
                  setSelectedMedia(media);
                  // Auto-transcribe if video
                  if (media.type === 'video') {
                    setIsProcessing(true);
                    setTimeout(() => {
                      setTranscript('This is a sample transcript of the uploaded video content...');
                      setIsProcessing(false);
                    }, 2000);
                  }
                }}
                selectedMedia={selectedMedia}
                onClear={() => {
                  setSelectedMedia(null);
                  setTranscript('');
                  setCreationMode(null);
                }}
              />

              {/* Creation Tools */}
              <CreationTools
                selectedMode={creationMode}
                onModeSelect={setCreationMode}
                hasMedia={!!selectedMedia}
                onGenerate={() => {
                  setIsProcessing(true);
                  setTimeout(() => {
                    setIsProcessing(false);
                    // Handle generation result
                  }, 3000);
                }}
                isProcessing={isProcessing}
              />

              {/* Transcript Toggle */}
              {transcript && (
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">Transcript</div>
                  <div className="text-sm text-gray-500">
                    {showTranscript ? 'Hide' : 'Show'} video transcript
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Center Panel - Canvas & Output */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Canvas Area */}
              <div className="flex-1 flex items-center justify-center bg-gray-50 relative">
                {selectedMedia ? (
                  <div className="w-full max-w-3xl" style={{ aspectRatio: '16 / 9' }}>
                    {selectedMedia.type === 'video' ? (
                      <video
                        src={selectedMedia.url}
                        controls
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <img
                        src={selectedMedia.url}
                        alt="Uploaded content"
                        loading="lazy"
                        decoding="async"
                        width={1280}
                        height={720}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                      <Play className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="text-lg font-medium mb-2">Upload media to get started</div>
                    <div className="text-sm">Choose a video or image to begin creating</div>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <div className="text-sm text-gray-600">Processing...</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Transcript Panel */}
              {showTranscript && transcript && (
                <div className="border-t border-gray-200 p-4 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Transcript</h3>
                    <button className="text-sm text-purple-600 hover:text-purple-700">
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {transcript}
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {creationMode && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {creationMode === 'overlay' && 'Text Overlay'}
                        {creationMode === 'frame' && 'Frame Extract'}
                        {creationMode === 'meme' && 'Meme Creator'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={!selectedMedia || !creationMode}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Generate
                    </button>
                    <button
                      disabled={!selectedMedia}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Agents */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">Expert Agents</h2>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Agent Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {AGENT_CATEGORIES.map((category) => (
                  <AgentRow key={category.id} category={category} />
                ))}
              </div>

              {/* Selected Agent Details */}
              {selectedAgent && (
                <div className="border-t border-gray-200 p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <img
                      src={selectedAgent.avatar}
                      alt={`${selectedAgent.name} avatar`}
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{selectedAgent.name}</div>
                      <div className="text-sm text-gray-500">
                        {selectedAgent.domains.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Agent Strengths & Limits */}
                  <div className="mb-3 text-xs">
                    <div className="mb-2">
                      <div className="font-medium text-gray-700 mb-1">Strengths:</div>
                      <ul className="text-gray-600 space-y-0.5">
                        {selectedAgent.strengths.slice(0, 3).map((strength, index) => (
                          <li key={index}>• {strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Limits:</div>
                      <ul className="text-gray-600 space-y-0.5">
                        {selectedAgent.limits.slice(0, 2).map((limit, index) => (
                          <li key={index}>• {limit}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Ask Agent */}
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="What do you want to make?"
                      value={agentQuery}
                      onChange={(e) => setAgentQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAgentQuery(agentQuery)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Sample Prompts */}
                  <div className="space-y-1">
                    {selectedAgent.samplePrompts.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => handleAgentQuery(prompt)}
                        className="w-full text-left px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded transition-colors"
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

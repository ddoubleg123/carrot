'use client';

import { useState } from 'react';
import { 
  Filter, 
  Search, 
  MessageSquare, 
  History, 
  Send, 
  Zap, 
  Eye, 
  Settings, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  ChevronDown, 
  Command, 
  Clock, 
  User, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Brain, 
  Target, 
  Palette, 
  Code, 
  FileText, 
  Shield 
} from 'lucide-react';
import { AgentOutputDemo } from '@/components/rabbit/AgentOutputDemo';

// Design Tokens
const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF',
  ink: '#0B0B0F',
  surface: '#FFFFFF',
  slate: '#64748B'
};

// Agent Categories with enhanced data structure
const AGENT_CATEGORIES = [
  {
    id: 'qa-audit',
    title: '🧪 QA & Audit',
    agents: [
      {
        id: 'design-guardian',
        name: 'Design Guardian',
        role: 'Enforcer',
        avatar: '/agents/design-guardian.png',
        skills: ['🕵️ Audit', '⚡ Actions', '📊 Metrics'],
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
        skills: ['♿ A11Y', '🎯 WCAG', '🔍 Scan'],
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
    title: '🛠️ Build & Spec',
    agents: [
      {
        id: 'spec-generator',
        name: 'Spec Generator',
        role: 'System Builder',
        avatar: '/agents/spec-generator.png',
        skills: ['✍️ Spec', '🎨 Tokens', '📐 Layout'],
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
        skills: ['📐 Grid', '📏 Spacing', '🎯 Alignment'],
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
    title: '👀 Reviewers',
    agents: [
      {
        id: 'typographer',
        name: 'Typographer',
        role: 'Type & Readability Agent',
        avatar: '/agents/typographer.png',
        skills: ['🔠 Type', '📖 Readability', '🎨 Contrast'],
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
        skills: ['🌀 Motion', '⏱️ Duration', '🎭 Easing'],
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

// Header Component
function Header({ onCreateAgent }: { onCreateAgent: () => void }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Design', 'Audit', 'Custom'];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-gray-900">Rabbit Workforce</h1>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeFilter === filter
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Search size={20} />
          </button>

          <button 
            onClick={onCreateAgent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// Enhanced Agent Tile Component - Phase 2
function AgentTile({ agent }: { agent: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-orange-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Available';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

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

// Agent Row Component
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

// Enhanced Chat Bar Component - Phase 3
function ChatBar() {
  const [message, setMessage] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showCommands, setShowCommands] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Slash commands
  const slashCommands = [
    { 
      command: '/audit', 
      description: 'Run accessibility and design audit',
      agent: 'Design Guardian',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    { 
      command: '/generate', 
      description: 'Generate design specs and tokens',
      agent: 'Spec Generator',
      icon: Zap,
      color: 'text-purple-600'
    },
    { 
      command: '/check', 
      description: 'Check layout and spacing',
      agent: 'Layout Inspector',
      icon: Eye,
      color: 'text-blue-600'
    },
    { 
      command: '/review', 
      description: 'Review typography and readability',
      agent: 'Typographer',
      icon: Settings,
      color: 'text-orange-600'
    }
  ];

  // Recent commands history
  const recentCommands = [
    'Run accessibility audit on homepage',
    'Generate design tokens for buttons',
    'Check grid alignment in header',
    'Review font sizes and contrast'
  ];

  // Get all agents for selector
  const allAgents = AGENT_CATEGORIES.flatMap(category => 
    category.agents.map(agent => ({
      ...agent,
      category: category.title
    }))
  );

  // Filter slash commands based on input
  const filteredCommands = slashCommands.filter(cmd =>
    message.toLowerCase().includes(cmd.command.toLowerCase()) ||
    (message.startsWith('/') && cmd.command.toLowerCase().includes(message.toLowerCase().slice(1)))
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Show slash commands if user types /
    if (value.startsWith('/') && value.length > 1) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  };

  const handleCommandSelect = (command: string) => {
    setMessage(command + ' ');
    setShowCommands(false);
  };

  const handleSend = () => {
    if (message.trim()) {
      console.log(`Sending to ${selectedAgent}: ${message}`);
      setMessage('');
      setShowCommands(false);
    }
  };

  const getAgentStatus = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-orange-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg backdrop-blur-sm bg-white/95 z-50">
      {/* Slash Commands Dropdown */}
      {showCommands && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-t-lg shadow-lg max-w-4xl mx-auto mb-1">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Command size={16} />
              <span>Slash Commands</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCommands.map((cmd, index) => {
              const IconComponent = cmd.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleCommandSelect(cmd.command)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-b-0"
                >
                  <div className={`p-2 rounded-lg bg-gray-100 ${cmd.color}`}>
                    <IconComponent size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{cmd.command}</div>
                    <div className="text-sm text-gray-500">{cmd.description}</div>
                    <div className="text-xs text-gray-400 mt-1">→ {cmd.agent}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* History Dropdown */}
      {showHistory && (
        <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-t-lg shadow-lg max-w-4xl mx-auto mb-1">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock size={16} />
              <span>Recent Commands</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {recentCommands.map((cmd, index) => (
              <button
                key={index}
                onClick={() => setMessage(cmd)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-b-0"
              >
                <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                  <History size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-900">{cmd}</div>
                  <div className="text-xs text-gray-400 mt-1">2 minutes ago</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agent Selector Dropdown */}
      {showAgentSelector && (
        <div className="absolute bottom-full right-0 bg-white border border-gray-200 rounded-t-lg shadow-lg mb-1 w-80">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User size={16} />
              <span>Select Agent</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {/* All Agents Option */}
            <button
              onClick={() => {
                setSelectedAgent('all');
                setShowAgentSelector(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 ${
                selectedAgent === 'all' ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                All
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">All Agents</div>
                <div className="text-sm text-gray-500">Broadcast to workforce</div>
              </div>
            </button>

            {/* Individual Agents */}
            {allAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent.id);
                  setShowAgentSelector(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-b-0 ${
                  selectedAgent === agent.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {agent.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${getAgentStatus(agent.status)} rounded-full border border-white`}></div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{agent.name}</div>
                  <div className="text-sm text-gray-500">{agent.role}</div>
                  <div className="text-xs text-gray-400">{agent.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Bar */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-3">
          {/* History Button */}
          <button 
            onClick={() => {
              setShowHistory(!showHistory);
              setShowAgentSelector(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              showHistory 
                ? 'text-blue-600 bg-blue-100' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <History size={20} />
          </button>
          
          {/* Message Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Ask an agent to help you... (try /audit or /generate)"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-12"
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            {message.startsWith('/') && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Command size={16} className="text-gray-400" />
              </div>
            )}
          </div>
          
          {/* Agent Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAgentSelector(!showAgentSelector);
                setShowHistory(false);
              }}
              className={`px-4 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none flex items-center gap-2 min-w-[160px] transition-all ${
                showAgentSelector ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-2 flex-1">
                {selectedAgent === 'all' ? (
                  <>
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      All
                    </div>
                    <span className="text-gray-700 text-sm">All Agents</span>
                  </>
                ) : (
                  (() => {
                    const agent = allAgents.find(a => a.id === selectedAgent);
                    return agent ? (
                      <>
                        <div className="relative">
                          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {agent.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${getAgentStatus(agent.status)} rounded-full border border-white`}></div>
                        </div>
                        <span className="text-gray-700 text-sm truncate">{agent.name}</span>
                      </>
                    ) : null;
                  })()
                )}
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${showAgentSelector ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {/* Send Button */}
          <button 
            onClick={handleSend}
            disabled={!message.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
            Send
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 mt-3 text-sm">
          <span className="text-gray-500">Quick:</span>
          {slashCommands.slice(0, 3).map((cmd, index) => (
            <button
              key={index}
              onClick={() => handleCommandSelect(cmd.command)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <cmd.icon size={14} className={cmd.color} />
              {cmd.command}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Agent Creation Modal - Phase 4
function CreateAgentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [agentData, setAgentData] = useState({
    name: '',
    role: '',
    category: '',
    description: '',
    skills: [] as string[],
    actions: [] as string[],
    personality: '',
    expertise: [] as string[]
  });

  const totalSteps = 4;

  // Predefined options
  const categories = [
    { id: 'qa-audit', title: '🧪 QA & Audit', description: 'Quality assurance and auditing specialists' },
    { id: 'build-spec', title: '🛠️ Build & Spec', description: 'System builders and specification generators' },
    { id: 'reviewers', title: '👀 Reviewers', description: 'Content and design reviewers' },
    { id: 'custom', title: '⚡ Custom', description: 'Create your own specialized category' }
  ];

  const skillOptions = [
    '🕵️ Audit', '⚡ Actions', '📊 Metrics', '♿ A11Y', '🎯 WCAG', '🔍 Scan',
    '✍️ Spec', '🎨 Tokens', '📐 Layout', '📏 Spacing', '🎯 Alignment',
    '🔠 Type', '📖 Readability', '🎨 Contrast', '🌀 Motion', '⏱️ Duration', '🎭 Easing'
  ];

  const actionOptions = [
    'Run Audit', 'Check Contrast', 'Scan A11Y', 'Generate Spec', 'Create Tokens',
    'Export CSS', 'Check Grid', 'Measure Spacing', 'Validate Layout', 'Review Type',
    'Check Readability', 'Test Contrast', 'Review Motion', 'Check Duration', 'Test Interactions'
  ];

  const personalityOptions = [
    { id: 'professional', label: 'Professional', description: 'Formal, precise, and methodical' },
    { id: 'friendly', label: 'Friendly', description: 'Approachable, helpful, and encouraging' },
    { id: 'expert', label: 'Expert', description: 'Authoritative, detailed, and technical' },
    { id: 'creative', label: 'Creative', description: 'Innovative, inspiring, and artistic' }
  ];

  const expertiseOptions = [
    'Design Systems', 'Accessibility', 'Performance', 'SEO', 'Typography', 'Color Theory',
    'User Experience', 'Frontend Development', 'CSS Architecture', 'Component Design',
    'Brand Guidelines', 'Responsive Design', 'Animation', 'Prototyping'
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkillToggle = (skill: string) => {
    setAgentData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleActionToggle = (action: string) => {
    setAgentData(prev => ({
      ...prev,
      actions: prev.actions.includes(action)
        ? prev.actions.filter(a => a !== action)
        : [...prev.actions, action]
    }));
  };

  const handleExpertiseToggle = (expertise: string) => {
    setAgentData(prev => ({
      ...prev,
      expertise: prev.expertise.includes(expertise)
        ? prev.expertise.filter(e => e !== expertise)
        : [...prev.expertise, expertise]
    }));
  };

  const handleCreate = () => {
    console.log('Creating agent:', agentData);
    // Here you would typically save the agent to your backend
    onClose();
    // Reset form
    setCurrentStep(1);
    setAgentData({
      name: '',
      role: '',
      category: '',
      description: '',
      skills: [],
      actions: [],
      personality: '',
      expertise: []
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create New Agent</h2>
              <p className="text-sm text-gray-500">Step {currentStep} of {totalSteps}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i + 1 <= currentStep 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {i + 1}
                </div>
                {i < totalSteps - 1 && (
                  <div className={`w-16 h-1 mx-2 rounded ${
                    i + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Basic Info</span>
            <span>Category</span>
            <span>Skills</span>
            <span>Review</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                <input
                  type="text"
                  value={agentData.name}
                  onChange={(e) => setAgentData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Design Guardian, Code Reviewer"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <input
                  type="text"
                  value={agentData.role}
                  onChange={(e) => setAgentData(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g., Accessibility Specialist, Design System Expert"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={agentData.description}
                  onChange={(e) => setAgentData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this agent specializes in and how it can help..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Category Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose a Category</h3>
                <p className="text-gray-600">Select the category that best fits your agent's purpose</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setAgentData(prev => ({ ...prev, category: category.id }))}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${
                      agentData.category === category.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{category.title.split(' ')[0]}</div>
                      <div>
                        <div className="font-medium text-gray-900">{category.title}</div>
                        <div className="text-sm text-gray-600">{category.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Skills and Actions */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Skills & Capabilities</h3>
                <p className="text-gray-600 mb-4">Select the skills your agent will have</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                  {skillOptions.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => handleSkillToggle(skill)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        agentData.skills.includes(skill)
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h3>
                <p className="text-gray-600 mb-4">Choose actions your agent can perform</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {actionOptions.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleActionToggle(action)}
                      className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                        agentData.actions.includes(action)
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review and Create */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Your Agent</h3>
                <p className="text-gray-600">Make sure everything looks good before creating</p>
              </div>

              {/* Agent Preview */}
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                    {agentData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">{agentData.name || 'Unnamed Agent'}</h4>
                    <p className="text-gray-600">{agentData.role || 'No role specified'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-500">Ready to deploy</span>
                    </div>
                  </div>
                </div>

                {agentData.description && (
                  <p className="text-gray-700 mb-4">{agentData.description}</p>
                )}

                {agentData.skills.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-900 mb-2">Skills</h5>
                    <div className="flex flex-wrap gap-2">
                      {agentData.skills.map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {agentData.actions.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Quick Actions</h5>
                    <div className="flex flex-wrap gap-2">
                      {agentData.actions.slice(0, 3).map((action, index) => (
                        <span key={index} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          {action}
                        </span>
                      ))}
                      {agentData.actions.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{agentData.actions.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-3">
            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && (!agentData.name || !agentData.role)) ||
                  (currentStep === 2 && !agentData.category)
                }
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus size={16} />
                Create Agent
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimalistic Agent Card - Avatar Focused
function AgentCard({ agent, onClick }: { agent: any; onClick: () => void }) {
  // Map agent names to actual avatar files
  const getAvatarPath = (agentName: string) => {
    const avatarMap: { [key: string]: string } = {
      'Design Guardian': '/agents/Alan Turing.png',
      'A11Y Auditor': '/agents/MLK.png',
      'Performance Bot': '/agents/John McCarthy.png',
      'Spec Generator': '/agents/Albert Einstein.png',
      'Layout Inspector': '/agents/Frederick Law Olmsted.png',
      'Token Builder': '/agents/Benjamin Graham.png',
      'Typographer': '/agents/Mark Twain.png',
      'Motion Moderator': '/agents/Sigmund Freud.png',
      'Copy Guardian': '/agents/Mother Jones.png',
      'Lighthouse Agent': '/agents/Edward Murrow.png',
      'Analytics Bot': '/agents/John Maynard Keynes.png'
    };
    return avatarMap[agentName] || '/agents/Alan Turing.png';
  };

  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
        {/* Avatar - Main Focus */}
        <div className="aspect-square relative">
          <img
            src={getAvatarPath(agent.name)}
            alt={agent.name}
            className="w-full h-full object-cover object-top"
          />
          {/* Subtle overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        </div>
        
        {/* Agent Info - Minimal */}
        <div className="p-4 text-center">
          <h3 className="font-bold text-gray-900 text-lg mb-1">{agent.name}</h3>
          <p className="text-sm text-gray-600 font-medium">{agent.role}</p>
        </div>
      </div>
    </div>
  );
}

// Agent Detail Modal
function AgentDetailModal({ agent, isOpen, onClose }: { agent: any; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !agent) return null;

  const getAvatarPath = (agentName: string) => {
    const avatarMap: { [key: string]: string } = {
      'Design Guardian': '/agents/Alan Turing.png',
      'A11Y Auditor': '/agents/MLK.png',
      'Performance Bot': '/agents/John McCarthy.png',
      'Spec Generator': '/agents/Albert Einstein.png',
      'Layout Inspector': '/agents/Frederick Law Olmsted.png',
      'Token Builder': '/agents/Benjamin Graham.png',
      'Typographer': '/agents/Mark Twain.png',
      'Motion Moderator': '/agents/Sigmund Freud.png',
      'Copy Guardian': '/agents/Mother Jones.png',
      'Lighthouse Agent': '/agents/Edward Murrow.png',
      'Analytics Bot': '/agents/John Maynard Keynes.png'
    };
    return avatarMap[agentName] || '/agents/Alan Turing.png';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img
                src={getAvatarPath(agent.name)}
                alt={agent.name}
                className="w-16 h-16 rounded-full object-cover object-top"
              />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{agent.name}</h2>
                <p className="text-gray-600">{agent.role}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Skills */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Expertise</h3>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((skill: string, index: number) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {agent.actions.map((action: any, index: number) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={index}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      action.primary
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <IconComponent size={20} />
                    <span className="font-medium">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Button */}
          <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <MessageSquare size={20} />
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Page Component - Minimalistic Design
export default function RabbitPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Generous white space and main phrase */}
      <div className="pt-24 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-12">Meet Your AI Agents</h1>
          
          {/* Prominent search box */}
          <div className="max-w-2xl mx-auto px-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for an AI agent..."
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors shadow-sm"
              />
              <Search className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Agent Grid - Avatar Focused */}
      <div className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {AGENT_CATEGORIES.flatMap(category => category.agents).map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onClick={() => handleAgentClick(agent)}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Agent Detail Modal */}
      <AgentDetailModal 
        agent={selectedAgent}
        isOpen={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}

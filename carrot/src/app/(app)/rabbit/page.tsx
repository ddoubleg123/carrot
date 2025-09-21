'use client';

import { useState } from 'react';
import './rabbit.css';
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
      },
      {
        id: 'performance-bot',
        name: 'Performance Bot',
        role: 'Speed & Web Vitals',
        avatar: '/agents/performance-bot.png',
        skills: ['⚡ Speed', '📊 Metrics', '🔍 Analysis'],
        actions: [
          { label: 'Run Lighthouse', icon: Play, primary: true },
          { label: 'Check Core Web Vitals', icon: Eye },
          { label: 'Optimize Assets', icon: Zap }
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
      },
      {
        id: 'token-builder',
        name: 'Token Builder',
        role: 'Design System Expert',
        avatar: '/agents/token-builder.png',
        skills: ['🎨 Tokens', '🎯 Consistency', '📐 Scale'],
        actions: [
          { label: 'Build Tokens', icon: Zap, primary: true },
          { label: 'Validate Scale', icon: CheckCircle },
          { label: 'Export Variables', icon: Settings }
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
      },
      {
        id: 'copy-guardian',
        name: 'Copy Guardian',
        role: 'Plain Language Checker',
        avatar: '/agents/copy-guardian.png',
        skills: ['📝 Copy', '📖 Readability', '🎯 Clarity'],
        actions: [
          { label: 'Review Copy', icon: Eye, primary: true },
          { label: 'Check Tone', icon: CheckCircle },
          { label: 'Improve Clarity', icon: Zap }
        ],
        status: 'online'
      }
    ]
  },
  {
    id: 'metrics',
    title: '📈 Metrics Agents',
    agents: [
      {
        id: 'lighthouse-agent',
        name: 'Lighthouse Agent',
        role: 'Performance Monitor',
        avatar: '/agents/lighthouse-agent.png',
        skills: ['📊 Performance', '⚡ Speed', '🔍 Analysis'],
        actions: [
          { label: 'Run Audit', icon: Play, primary: true },
          { label: 'Check Scores', icon: Eye },
          { label: 'Generate Report', icon: FileText }
        ],
        status: 'online'
      },
      {
        id: 'analytics-bot',
        name: 'Analytics Bot',
        role: 'Data Insights',
        avatar: '/agents/analytics-bot.png',
        skills: ['📊 Data', '📈 Trends', '🔍 Insights'],
        actions: [
          { label: 'Analyze Data', icon: Play, primary: true },
          { label: 'Generate Report', icon: FileText },
          { label: 'Track Trends', icon: Eye }
        ],
        status: 'online'
      }
    ]
  }
];


// Enhanced Agent Tile Component - Netflix Style
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

  // Portrait mapping based on your reference image
  const getPortraitStyle = (agentName: string) => {
    const portraits: { [key: string]: { bg: string; initials: string; gradient: string } } = {
      'Design Guardian': { bg: 'from-purple-500 to-pink-500', initials: 'DG', gradient: 'from-purple-400 via-pink-400 to-orange-400' },
      'A11Y Auditor': { bg: 'from-blue-500 to-cyan-500', initials: 'AA', gradient: 'from-blue-400 via-cyan-400 to-teal-400' },
      'Performance Bot': { bg: 'from-green-500 to-emerald-500', initials: 'PB', gradient: 'from-green-400 via-emerald-400 to-lime-400' },
      'Spec Generator': { bg: 'from-orange-500 to-red-500', initials: 'SG', gradient: 'from-orange-400 via-red-400 to-pink-400' },
      'Layout Inspector': { bg: 'from-indigo-500 to-purple-500', initials: 'LI', gradient: 'from-indigo-400 via-purple-400 to-pink-400' },
      'Token Builder': { bg: 'from-teal-500 to-blue-500', initials: 'TB', gradient: 'from-teal-400 via-blue-400 to-indigo-400' },
      'Typographer': { bg: 'from-amber-500 to-yellow-500', initials: 'TY', gradient: 'from-amber-400 via-yellow-400 to-orange-400' },
      'Motion Moderator': { bg: 'from-violet-500 to-purple-500', initials: 'MM', gradient: 'from-violet-400 via-purple-400 to-pink-400' },
      'Copy Guardian': { bg: 'from-rose-500 to-pink-500', initials: 'CG', gradient: 'from-rose-400 via-pink-400 to-red-400' },
      'Lighthouse Agent': { bg: 'from-sky-500 to-blue-500', initials: 'LA', gradient: 'from-sky-400 via-blue-400 to-indigo-400' },
      'Analytics Bot': { bg: 'from-emerald-500 to-green-500', initials: 'AB', gradient: 'from-emerald-400 via-green-400 to-lime-400' }
    };
    
    return portraits[agentName] || { bg: 'from-gray-500 to-gray-600', initials: agent.name.split(' ').map((n: string) => n[0]).join(''), gradient: 'from-gray-400 to-gray-500' };
  };

  const portrait = getPortraitStyle(agent.name);

  return (
    <div className="agent-tile group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-blue-500/20 hover:shadow-blue-500/10 p-6 min-w-[280px] max-w-[280px] border border-gray-100">
      <div className="flex flex-col items-center text-center">
        {/* Portrait with status indicator - Netflix style */}
        <div className="relative mb-6">
          <div className={`w-24 h-24 bg-gradient-to-br ${portrait.bg} rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl relative overflow-hidden`}>
            {/* Portrait background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${portrait.gradient} opacity-80`}></div>
            <div className="relative z-10 text-white font-bold text-xl">
              {portrait.initials}
            </div>
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          </div>
          {/* Status indicator */}
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${getStatusColor(agent.status)} rounded-full border-3 border-white flex items-center justify-center status-indicator shadow-lg`}>
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
        
        {/* Agent info */}
        <h3 className="font-bold text-gray-900 mb-1 text-xl">{agent.name}</h3>
        <p className="text-sm text-gray-600 mb-2 font-medium">{agent.role}</p>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2 h-2 ${getStatusColor(agent.status)} rounded-full`}></div>
          <p className="text-xs text-gray-500 font-medium">{getStatusText(agent.status)}</p>
        </div>
        
        {/* Skills badges - more refined */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {agent.skills.map((skill: string, index: number) => (
            <span
              key={index}
              className="px-3 py-1.5 bg-gray-50 text-gray-700 text-xs font-semibold rounded-full border border-gray-200 hover:border-gray-300 transition-colors"
            >
              {skill}
            </span>
          ))}
        </div>
        
        {/* Quick actions - Netflix style */}
        <div className="flex flex-col gap-3 w-full">
          {agent.actions.slice(0, 2).map((action: any, index: number) => {
            const IconComponent = action.icon;
            return (
              <button
                key={index}
                className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 min-h-[48px] ${
                  action.primary
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <IconComponent size={18} />
                {action.label}
              </button>
            );
          })}
          
          {/* Chat button - more prominent */}
          <button className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all duration-200 min-h-[48px] border-2 border-blue-200 hover:border-blue-300 hover:shadow-md">
            <MessageSquare size={18} />
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}

// Agent Row Component - Netflix Style
function AgentRow({ category }: { category: any }) {
  return (
    <div className="agent-category mb-16">
      <div className="px-6 mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">{category.title}</h2>
        <p className="text-gray-600 text-lg">Specialized agents for {category.title.toLowerCase().replace(/[🧪🛠️👀📈]/g, '').trim()}</p>
      </div>
      <div className="flex gap-6 overflow-x-auto px-6 pb-6 scrollbar-hide">
        {category.agents.map((agent: any) => (
          <AgentTile key={agent.id} agent={agent} />
        ))}
        
        {/* Add new agent tile - Netflix style */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-2xl p-8 min-w-[280px] max-w-[280px] flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 transition-all duration-300 cursor-pointer group shadow-lg hover:shadow-xl">
          <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 group-hover:from-blue-200 group-hover:to-blue-300 rounded-2xl mb-6 flex items-center justify-center transition-all duration-300 shadow-lg">
            <Plus size={40} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <h3 className="text-gray-700 font-bold mb-2 text-lg">Create New Agent</h3>
          <p className="text-sm text-gray-500 font-medium">Custom specialist for your workflow</p>
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
    <div className="relative">
      {/* Slash Commands Dropdown */}
      {showCommands && filteredCommands.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-50">
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
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 z-50">
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
        <div className="absolute top-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-80 z-50">
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

// Main Page Component
export default function RabbitPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🐰 Rabbit Workforce</h1>
              <p className="text-gray-600 text-lg">AI-powered agents for design, development, and quality assurance</p>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-semibold"
            >
              <Plus size={20} />
              Create New Agent
            </button>
          </div>
        </div>
      </div>

      {/* Chat Bar - Middle Upper Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <ChatBar />
      </div>
      
      {/* Agent Categories Grid - Netflix Style */}
      <div className="py-8">
        {AGENT_CATEGORIES.map((category) => (
          <AgentRow key={category.id} category={category} />
        ))}
      </div>
      
      {/* Create Agent Modal */}
      {isModalOpen && (
        <CreateAgentModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
}

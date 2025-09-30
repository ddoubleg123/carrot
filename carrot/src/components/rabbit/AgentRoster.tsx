'use client';

import React, { useState } from 'react';
import { 
  Search, 
  X, 
  Pin, 
  EyeOff, 
  Users 
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: string;
  expertise: string[];
  description?: string;
}

interface AgentRosterProps {
  agents: Agent[];
  activeAgents: string[];
  onToggleAgent: (agentId: string) => void;
  onRemoveAgent: (agentId: string) => void;
  onPinAgent: (agentId: string) => void;
  onHideAgent: (agentId: string) => void;
}

export default function AgentRoster({ 
  agents, 
  activeAgents, 
  onToggleAgent, 
  onRemoveAgent,
  onPinAgent,
  onHideAgent 
}: AgentRosterProps) {
  const [showSettings, setShowSettings] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'responding': return 'bg-orange-500';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Agent Preferences</h4>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
              <Pin size={16} />
              Pin agents to always include
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
              <EyeOff size={16} />
              Hide agents from auto-join
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
              <Users size={16} />
              Curate "My Council"
            </button>
          </div>
        </div>
      )}
      
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* Active Agents */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pt-6">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Active Advisors</h4>
          <div className="space-y-3">
            {agents
              .filter(agent => activeAgents.includes(agent.id))
              .map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <div className="relative">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        console.error('Agent avatar failed to load:', agent.avatar);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(agent.status)} rounded-full border-2 border-white`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{agent.name}</p>
                    <p className="text-sm text-gray-500 truncate">{agent.role}</p>
                  </div>

                  <button
                    onClick={() => onRemoveAgent(agent.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Available Agents */}
        <div className="p-4 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Available Agents</h4>
          <div className="space-y-2">
            {agents
              .filter(agent => !activeAgents.includes(agent.id))
              .map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onToggleAgent(agent.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      console.error('Agent avatar failed to load:', agent.avatar);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{agent.name}</p>
                    <p className="text-sm text-gray-500 truncate">{agent.role}</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

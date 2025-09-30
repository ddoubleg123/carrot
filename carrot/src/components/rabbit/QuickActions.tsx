'use client';

import React from 'react';
import { 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Command, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Target, 
  Palette, 
  Code, 
  Shield,
  Brain,
  MessageSquare,
  History
} from 'lucide-react';

interface QuickAction {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}

interface QuickActionsProps {
  onActionClick: (actionId: string) => void;
}

export default function QuickActions({ onActionClick }: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      id: 'analyze',
      icon: Target,
      label: 'Analyze',
      description: 'Deep analysis of any topic',
      color: 'bg-blue-500',
      onClick: () => onActionClick('analyze')
    },
    {
      id: 'design',
      icon: Palette,
      label: 'Design',
      description: 'Creative design solutions',
      color: 'bg-purple-500',
      onClick: () => onActionClick('design')
    },
    {
      id: 'code',
      icon: Code,
      label: 'Code',
      description: 'Programming assistance',
      color: 'bg-green-500',
      onClick: () => onActionClick('code')
    },
    {
      id: 'security',
      icon: Shield,
      label: 'Security',
      description: 'Security analysis & advice',
      color: 'bg-red-500',
      onClick: () => onActionClick('security')
    },
    {
      id: 'brainstorm',
      icon: Brain,
      label: 'Brainstorm',
      description: 'Creative ideation session',
      color: 'bg-yellow-500',
      onClick: () => onActionClick('brainstorm')
    },
    {
      id: 'research',
      icon: MessageSquare,
      label: 'Research',
      description: 'Comprehensive research',
      color: 'bg-indigo-500',
      onClick: () => onActionClick('research')
    }
  ];

  return (
    <div className="p-6 bg-white border-b border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h3>
        <p className="text-sm text-gray-600">Get instant help with common tasks</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              className="group p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 ${action.color} rounded-lg text-white group-hover:scale-110 transition-transform`}>
                  <IconComponent size={20} />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900 group-hover:text-gray-700">
                    {action.label}
                  </h4>
                  <p className="text-xs text-gray-500 group-hover:text-gray-600">
                    {action.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Recent Activity</h4>
          <button className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
            <History size={12} />
            View All
          </button>
        </div>
        
        <div className="space-y-2">
          {[
            { action: 'Analyzed market trends', time: '2 min ago', status: 'completed' },
            { action: 'Generated design mockup', time: '15 min ago', status: 'completed' },
            { action: 'Code review in progress', time: '1 hour ago', status: 'pending' }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <div className={`w-2 h-2 rounded-full ${
                item.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{item.action}</p>
                <p className="text-xs text-gray-500">{item.time}</p>
              </div>
              {item.status === 'completed' ? (
                <CheckCircle size={16} className="text-green-500" />
              ) : (
                <Clock size={16} className="text-yellow-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

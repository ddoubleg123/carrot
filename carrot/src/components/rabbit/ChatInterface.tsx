'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Upload, 
  Image, 
  File, 
  Command,
  Clock,
  User,
  ArrowRight,
  ArrowLeft,
  Target,
  Palette,
  Code,
  Shield
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onUploadFile: (file: File) => void;
  isTyping: boolean;
  activeAgents: string[];
}

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  onUploadFile, 
  isTyping,
  activeAgents 
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isUploading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      onUploadFile(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => setIsUploading(false), 1000);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.sender === 'user'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.sender === 'agent' && message.agentName && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <User size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {message.agentName}
                  </span>
                </div>
              )}
              
              <p className="text-sm leading-relaxed">{message.content}</p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-70">
                  {formatTime(message.timestamp)}
                </span>
                {message.status === 'sending' && (
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <User size={12} className="text-white" />
                </div>
                <span className="text-xs font-medium text-gray-600">AI Agent</span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          {/* File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
            ) : (
              <Upload size={20} />
            )}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Ask ${activeAgents.length} AI agent${activeAgents.length !== 1 ? 's' : ''} anything...`}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            {/* Quick Actions */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Add image"
              >
                <Image size={16} />
              </button>
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Add file"
              >
                <File size={16} />
              </button>
            </div>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputValue.trim() || isUploading}
            className="p-3 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>

        {/* Quick Commands */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { icon: Target, label: 'Analyze', command: '/analyze' },
            { icon: Palette, label: 'Design', command: '/design' },
            { icon: Code, label: 'Code', command: '/code' },
            { icon: Shield, label: 'Security', command: '/security' }
          ].map(({ icon: Icon, label, command }) => (
            <button
              key={command}
              type="button"
              onClick={() => setInputValue(command + ' ')}
              className="flex items-center gap-1 px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

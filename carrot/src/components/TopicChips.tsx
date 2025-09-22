"use client";

import React from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Topic {
  id: string;
  name: string;
  count?: number;
}

interface TopicChipsProps {
  topics: Topic[];
  selected: string[];
  excluded: string[];
  onToggle: (id: string) => void;
  onExclude: (id: string) => void;
  className?: string;
  loading?: boolean;
  empty?: boolean;
  onFollowTopic?: (id: string) => void;
}

export function TopicChips({
  topics,
  selected,
  excluded,
  onToggle,
  onExclude,
  className,
  loading = false,
  empty = false,
  onFollowTopic
}: TopicChipsProps) {
  // Handle long press for exclude functionality
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    const startTime = Date.now();
    const handleMouseUp = () => {
      const duration = Date.now() - startTime;
      if (duration > 500) { // Long press threshold
        onExclude(id);
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Alt' && e.key === 'Enter') {
      e.preventDefault();
      onExclude(id);
    }
  };

  if (loading) {
    return (
      <div className={cn("px-4 sm:px-6 lg:px-8 py-3", className)}>
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-8 w-20 bg-gray-200 rounded-full animate-pulse flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={cn("px-4 sm:px-6 lg:px-8 py-3", className)}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-3">No topics available</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {['Technology', 'Politics', 'Economics'].map((topic) => (
                <button
                  key={topic}
                  onClick={() => onFollowTopic?.(topic.toLowerCase().replace(' ', '-'))}
                  className="px-3 py-1.5 rounded-full border border-[#E6E8EC] text-sm text-gray-700 hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2"
                >
                  Follow {topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("px-4 sm:px-6 lg:px-8 py-3", className)}>
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {topics.map((topic) => {
            const isSelected = selected.includes(topic.id);
            const isExcluded = excluded.includes(topic.id);
            
            return (
              <button
                key={topic.id}
                onClick={() => onToggle(topic.id)}
                onMouseDown={(e) => handleMouseDown(e, topic.id)}
                onKeyDown={(e) => handleKeyDown(e, topic.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2 flex-shrink-0",
                  {
                    // Selected state - solid with gradient hint
                    "bg-gradient-to-r from-[#FF6A00] to-[#0A5AFF] text-white shadow-sm": isSelected,
                    // Excluded state - dashed outline with minus
                    "border-2 border-dashed border-gray-400 text-gray-500 bg-gray-50": isExcluded,
                    // Default state
                    "border border-[#E6E8EC] text-gray-700 bg-white hover:border-[#FF6A00] hover:text-[#FF6A00]": !isSelected && !isExcluded
                  }
                )}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Remove' : 'Add'} ${topic.name} filter`}
              >
                {isExcluded && <X size={14} />}
                <span>{topic.name}</span>
                {topic.count && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    isSelected ? "bg-white/20" : "bg-gray-100"
                  )}>
                    {topic.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

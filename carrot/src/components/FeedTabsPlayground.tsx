"use client";

import React, { useState } from "react";
import { FeedTabs, FeedView } from "./FeedTabs";
import { TopicChips, Topic } from "./TopicChips";

// Sample topics for demonstration
const DEMO_TOPICS: Topic[] = [
  { id: "technology", name: "Technology", count: 1240 },
  { id: "politics", name: "Politics", count: 980 },
  { id: "economics", name: "Economics", count: 2100 },
  { id: "climate", name: "Climate", count: 1560 },
  { id: "health", name: "Health", count: 890 },
  { id: "education", name: "Education", count: 750 },
  { id: "crypto", name: "Crypto", count: 3200 },
  { id: "ai", name: "AI", count: 1800 },
];

export function FeedTabsPlayground() {
  const [view, setView] = useState<FeedView>("foryou");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [excludedTopics, setExcludedTopics] = useState<string[]>([]);
  const [liveCount, setLiveCount] = useState(0);

  const handleToggleTopic = (topicId: string) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter(id => id !== topicId));
    } else {
      setSelectedTopics([...selectedTopics, topicId]);
      setExcludedTopics(excludedTopics.filter(id => id !== topicId));
    }
  };

  const handleExcludeTopic = (topicId: string) => {
    if (excludedTopics.includes(topicId)) {
      setExcludedTopics(excludedTopics.filter(id => id !== topicId));
    } else {
      setExcludedTopics([...excludedTopics, topicId]);
      setSelectedTopics(selectedTopics.filter(id => id !== topicId));
    }
  };

  const handleLiveUpdate = () => {
    setLiveCount(prev => prev + 1);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Feed Tabs Playground</h1>
        <p className="text-gray-600">Interactive demonstration of the Feed Tabs component</p>
      </div>

      {/* Demo Controls */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Demo Controls</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleLiveUpdate}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Simulate New Post (+1)
          </button>
          <button
            onClick={() => setLiveCount(0)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Clear Live Count
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>Current state:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>View: <code className="bg-gray-200 px-1 rounded">{view}</code></li>
            <li>Selected topics: <code className="bg-gray-200 px-1 rounded">{selectedTopics.join(', ') || 'none'}</code></li>
            <li>Excluded topics: <code className="bg-gray-200 px-1 rounded">{excludedTopics.join(', ') || 'none'}</code></li>
            <li>Live count: <code className="bg-gray-200 px-1 rounded">{liveCount}</code></li>
          </ul>
        </div>
      </div>

      {/* Feed Tabs Demo */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Feed Tabs Component</h2>
        </div>
        
        <FeedTabs
          value={view}
          onChange={setView}
          showLive={liveCount > 0}
          count={liveCount}
        />
        
        {view === "subjects" && (
          <TopicChips
            topics={DEMO_TOPICS}
            selected={selectedTopics}
            excluded={excludedTopics}
            onToggle={handleToggleTopic}
            onExclude={handleExcludeTopic}
          />
        )}
      </div>

      {/* States Demo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loading State */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Loading State</h3>
          </div>
          <div className="p-4">
            <TopicChips
              topics={[]}
              selected={[]}
              excluded={[]}
              onToggle={() => {}}
              onExclude={() => {}}
              loading={true}
            />
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Empty State</h3>
          </div>
          <div className="p-4">
            <TopicChips
              topics={[]}
              selected={[]}
              excluded={[]}
              onToggle={() => {}}
              onExclude={() => {}}
              empty={true}
            />
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-blue-50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Usage Instructions</h2>
        <div className="space-y-3 text-sm">
          <div>
            <strong>Tab Navigation:</strong> Click on Following, For You, or Subjects to switch views
          </div>
          <div>
            <strong>Topic Selection:</strong> Click on topic chips to include them in your feed
          </div>
          <div>
            <strong>Topic Exclusion:</strong> Long-press (500ms+) or Alt+Click on topic chips to exclude them
          </div>
          <div>
            <strong>Live Updates:</strong> Click "Simulate New Post" to see the live pill in action
          </div>
          <div>
            <strong>Keyboard:</strong> Use Tab to navigate, Enter to activate, Esc to clear focus
          </div>
        </div>
      </div>
    </div>
  );
}

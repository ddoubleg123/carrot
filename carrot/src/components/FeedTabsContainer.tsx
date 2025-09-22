"use client";

import React from "react";
import { FeedTabs, FeedView } from "./FeedTabs";
import { TopicChips, Topic } from "./TopicChips";
import { useFeedView } from "@/hooks/useFeedView";

interface FeedTabsContainerProps {
  className?: string;
}

// Sample topics data - in a real app, this would come from an API
const SAMPLE_TOPICS: Topic[] = [
  { id: "technology", name: "Technology", count: 1240 },
  { id: "politics", name: "Politics", count: 980 },
  { id: "economics", name: "Economics", count: 2100 },
  { id: "climate", name: "Climate", count: 1560 },
  { id: "health", name: "Health", count: 890 },
  { id: "education", name: "Education", count: 750 },
  { id: "crypto", name: "Crypto", count: 3200 },
  { id: "ai", name: "AI", count: 1800 },
  { id: "space", name: "Space", count: 650 },
  { id: "sports", name: "Sports", count: 1100 },
];

export function FeedTabsContainer({ className }: FeedTabsContainerProps) {
  const {
    view,
    selectedTopics,
    excludedTopics,
    liveCount,
    isInitialized,
    setView,
    toggleTopic,
    excludeTopic,
    setLiveCount,
  } = useFeedView();

  // Don't render until initialized to prevent hydration mismatch
  if (!isInitialized) {
    return (
      <div className={className}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#E6E8EC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className="flex gap-1 rounded-full bg-gray-100 p-1 h-10">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-20 h-8 bg-gray-200 rounded-full animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <FeedTabs
        value={view}
        onChange={setView}
        showLive={liveCount > 0}
        count={liveCount}
      />
      
      {/* Show topic chips only when Subjects tab is active */}
      {view === "subjects" && (
        <TopicChips
          topics={SAMPLE_TOPICS}
          selected={selectedTopics}
          excluded={excludedTopics}
          onToggle={toggleTopic}
          onExclude={excludeTopic}
          onFollowTopic={(id) => {
            // TODO: Implement follow topic logic
            console.log("Follow topic:", id);
          }}
        />
      )}
    </div>
  );
}

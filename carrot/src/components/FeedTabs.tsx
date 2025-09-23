"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";

export type FeedView = "following" | "foryou" | "subjects";

interface FeedTabsProps {
  value: FeedView;
  onChange: (value: FeedView) => void;
  showLive?: boolean;
  count?: number;
  className?: string;
}

export function FeedTabs({ 
  value, 
  onChange, 
  showLive = false, 
  count = 0,
  className 
}: FeedTabsProps) {
  return (
    <div className={cn(
      "sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#E6E8EC] rounded-2xl mx-4 mt-4",
      className
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-4 relative">
          {/* Tabs - Centered */}
          <Tabs value={value} onValueChange={(v) => onChange(v as FeedView)}>
            <TabsList className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1 h-10">
              <TabsTrigger
                value="following"
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2"
              >
                Following
              </TabsTrigger>
              <TabsTrigger
                value="foryou"
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2"
              >
                For You
              </TabsTrigger>
              <TabsTrigger
                value="subjects"
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-700 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2"
              >
                Subjects
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Live Pill - Positioned absolutely on the right */}
          {showLive && count > 0 && (
            <button
              onClick={() => {
                // TODO: Implement live update logic
                console.log("Live update clicked");
              }}
              className="absolute right-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF6A00] to-[#0A5AFF] text-white text-sm font-medium hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2"
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span>Live • {count} new</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

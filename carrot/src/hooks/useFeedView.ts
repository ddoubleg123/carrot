"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedView } from "@/components/FeedTabs";

interface FeedViewState {
  view: FeedView;
  selectedTopics: string[];
  excludedTopics: string[];
  liveCount: number;
}

const STORAGE_KEY = "carrot-feed-view";
const DEFAULT_STATE: FeedViewState = {
  view: "foryou",
  selectedTopics: [],
  excludedTopics: [],
  liveCount: 0,
};

export function useFeedView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [state, setState] = useState<FeedViewState>(DEFAULT_STATE);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state from URL params and localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Parse URL params
    const view = (searchParams.get("view") as FeedView) || DEFAULT_STATE.view;
    const topicsParam = searchParams.get("topics");
    const excludeParam = searchParams.get("exclude");
    
    const selectedTopics = topicsParam ? topicsParam.split(",").filter(Boolean) : [];
    const excludedTopics = excludeParam ? excludeParam.split(",").filter(Boolean) : [];

    // Get stored preferences
    const stored = localStorage.getItem(STORAGE_KEY);
    let storedState = DEFAULT_STATE;
    
    if (stored) {
      try {
        storedState = { ...DEFAULT_STATE, ...JSON.parse(stored) };
      } catch (e) {
        console.warn("Failed to parse stored feed view state:", e);
      }
    }

    // URL params take precedence over stored state
    const newState: FeedViewState = {
      view: view || storedState.view,
      selectedTopics: selectedTopics.length > 0 ? selectedTopics : storedState.selectedTopics,
      excludedTopics: excludedTopics.length > 0 ? excludedTopics : storedState.excludedTopics,
      liveCount: storedState.liveCount,
    };

    setState(newState);
    setIsInitialized(true);
  }, [searchParams]);

  // Update URL when state changes
  const updateURL = useCallback((newState: FeedViewState) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update view param
    if (newState.view !== DEFAULT_STATE.view) {
      params.set("view", newState.view);
    } else {
      params.delete("view");
    }

    // Update topics param
    if (newState.selectedTopics.length > 0) {
      params.set("topics", newState.selectedTopics.join(","));
    } else {
      params.delete("topics");
    }

    // Update exclude param
    if (newState.excludedTopics.length > 0) {
      params.set("exclude", newState.excludedTopics.join(","));
    } else {
      params.delete("exclude");
    }

    // Update URL without causing a page reload
    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newURL, { scroll: false });
  }, [router, searchParams]);

  // Update localStorage when state changes
  const updateStorage = useCallback((newState: FeedViewState) => {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.warn("Failed to save feed view state:", e);
    }
  }, []);

  // Set view
  const setView = useCallback((view: FeedView) => {
    const newState = { ...state, view };
    setState(newState);
    updateURL(newState);
    updateStorage(newState);
  }, [state, updateURL, updateStorage]);

  // Toggle topic selection
  const toggleTopic = useCallback((topicId: string) => {
    const newState = { ...state };
    
    if (newState.selectedTopics.includes(topicId)) {
      // Remove from selected
      newState.selectedTopics = newState.selectedTopics.filter(id => id !== topicId);
    } else {
      // Add to selected, remove from excluded if present
      newState.selectedTopics = [...newState.selectedTopics, topicId];
      newState.excludedTopics = newState.excludedTopics.filter(id => id !== topicId);
    }
    
    setState(newState);
    updateURL(newState);
    updateStorage(newState);
  }, [state, updateURL, updateStorage]);

  // Exclude topic
  const excludeTopic = useCallback((topicId: string) => {
    const newState = { ...state };
    
    if (newState.excludedTopics.includes(topicId)) {
      // Remove from excluded
      newState.excludedTopics = newState.excludedTopics.filter(id => id !== topicId);
    } else {
      // Add to excluded, remove from selected if present
      newState.excludedTopics = [...newState.excludedTopics, topicId];
      newState.selectedTopics = newState.selectedTopics.filter(id => id !== topicId);
    }
    
    setState(newState);
    updateURL(newState);
    updateStorage(newState);
  }, [state, updateURL, updateStorage]);

  // Update live count
  const setLiveCount = useCallback((count: number) => {
    const newState = { ...state, liveCount: count };
    setState(newState);
    updateStorage(newState);
  }, [state, updateStorage]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    const newState = {
      ...state,
      selectedTopics: [],
      excludedTopics: [],
    };
    setState(newState);
    updateURL(newState);
    updateStorage(newState);
  }, [state, updateURL, updateStorage]);

  return {
    ...state,
    isInitialized,
    setView,
    toggleTopic,
    excludeTopic,
    setLiveCount,
    clearFilters,
  };
}

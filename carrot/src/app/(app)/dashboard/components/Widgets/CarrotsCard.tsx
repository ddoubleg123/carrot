"use client";

import { TrophyIcon, BoltIcon, FireIcon } from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";

interface UserStats {
  totalCarrots: number;
  weeklyGoal: number;
  weeklyCurrent: number;
  weeklyPercentage: number;
  streakDays: number;
  breakdown: {
    carrotsFromPosts: number;
    engagementCarrots: number;
    likesReceived: number;
    commentsReceived: number;
    savesReceived: number;
    patchesJoined: number;
    weeklyPosts: number;
    weeklyLikes: number;
  };
}

export default function CarrotsCard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/user/stats');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user stats');
        }
        
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching user stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stats');
        // Fallback to placeholder data
        setStats({
          totalCarrots: 0,
          weeklyGoal: 50,
          weeklyCurrent: 0,
          weeklyPercentage: 0,
          streakDays: 0,
          breakdown: {
            carrotsFromPosts: 0,
            engagementCarrots: 0,
            likesReceived: 0,
            commentsReceived: 0,
            savesReceived: 0,
            patchesJoined: 0,
            weeklyPosts: 0,
            weeklyLikes: 0
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Use real data or fallback to defaults
  const total = stats?.totalCarrots ?? 0;
  const weekly = { 
    current: stats?.weeklyCurrent ?? 0, 
    goal: stats?.weeklyGoal ?? 50 
  };
  const streakDays = stats?.streakDays ?? 0;
  const weeklyPct = stats?.weeklyPercentage ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 w-full border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Carrots Earned</h2>
        </div>
        <button className="text-xs text-gray-500 hover:text-orange-600">How to earn more</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-sm text-red-500 mb-2">Failed to load stats</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-xs text-orange-600 hover:text-orange-700"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-gray-900">{total.toLocaleString()}</div>
              <div className="text-xs text-gray-500">all time</div>
            </div>
            {streakDays > 0 && (
              <div className="flex items-center gap-1 text-orange-600">
                <FireIcon className="h-5 w-5" />
                <span className="text-sm font-medium">{streakDays}-day streak</span>
              </div>
            )}
          </div>

          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <span>Weekly goal</span>
            <span>
              {weekly.current}/{weekly.goal} ({weeklyPct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${weeklyPct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

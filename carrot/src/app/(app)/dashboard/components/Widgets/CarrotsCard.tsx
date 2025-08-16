"use client";

import { TrophyIcon, BoltIcon, FireIcon } from "@heroicons/react/24/solid";

export default function CarrotsCard() {
  // Placeholder metrics
  const total = 1859;
  const weekly = { current: 320, goal: 500 };
  const streakDays = 7;
  const weeklyPct = Math.min(100, Math.round((weekly.current / weekly.goal) * 100));

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 w-full border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Carrots Earned</h2>
        </div>
        <button className="text-xs text-gray-500 hover:text-orange-600">How to earn more</button>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-3xl font-bold text-gray-900">{total.toLocaleString()}</div>
          <div className="text-xs text-gray-500">all time</div>
        </div>
        <div className="flex items-center gap-1 text-orange-600">
          <FireIcon className="h-5 w-5" />
          <span className="text-sm font-medium">{streakDays}-day streak</span>
        </div>
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
    </div>
  );
}

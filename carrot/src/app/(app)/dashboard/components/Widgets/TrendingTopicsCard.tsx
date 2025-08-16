"use client";

import { HashtagIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export default function TrendingTopicsCard() {
  const topics = [
    { id: "t1", label: "clean-energy", volume: 1240, momentum: "up" as const },
    { id: "t2", label: "ubi", volume: 980, momentum: "flat" as const },
    { id: "t3", label: "term-limits", volume: 2110, momentum: "up" as const },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 w-full border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Trending Topics</h2>
        </div>
        <button className="text-xs text-gray-500 hover:text-orange-600 flex items-center gap-1">
          View all <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={t.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">#{t.label}</span>
              <span className="text-xs text-gray-500 truncate">{t.volume.toLocaleString()} mentions</span>
            </div>
            <span className={`text-xs font-medium ${t.momentum === "up" ? "text-green-600" : "text-gray-500"}`}>
              {t.momentum === "up" ? "↑ rising" : "→ stable"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { CalendarDaysIcon } from "@heroicons/react/24/outline";

export default function WeekInReviewCard() {
  const metrics = [
    { id: "k1", label: "Posts", value: 5, delta: "+2" },
    { id: "k2", label: "New followers", value: 28, delta: "+6" },
    { id: "k3", label: "Engagements", value: 612, delta: "+14%" },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 w-full border border-[#E6E8EC]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Your Week in Review</h2>
        </div>
        <button className="text-xs text-gray-500 hover:text-orange-600">View analytics</button>
      </div>

      <ul className="divide-y divide-[#E6E8EC]">
        {metrics.map((m) => (
          <li key={m.id} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm text-[#57534E]">{m.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums text-[#1C1917]">{m.value}</span>
              <span className="text-xs font-medium text-[#15803D]">{m.delta}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

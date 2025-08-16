"use client";

import { CalendarDaysIcon } from "@heroicons/react/24/outline";

export default function WeekInReviewCard() {
  const metrics = [
    { id: "k1", label: "Posts", value: 5, delta: "+2" },
    { id: "k2", label: "New followers", value: 28, delta: "+6" },
    { id: "k3", label: "Engagements", value: 612, delta: "+14%" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 w-full border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Your Week in Review</h2>
        </div>
        <button className="text-xs text-gray-500 hover:text-orange-600">View analytics</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.id} className="rounded-lg border border-gray-100 p-2 text-center">
            <div className="text-lg font-semibold text-gray-900">{m.value}</div>
            <div className="text-xs text-gray-500">{m.label}</div>
            <div className="text-[10px] mt-1 font-medium text-green-600">{m.delta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

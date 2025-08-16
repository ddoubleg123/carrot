"use client";

import Image from "next/image";
import { UserPlusIcon } from "@heroicons/react/24/outline";

export default function NewConnectionsCard() {
  const people = [
    { id: "u1", name: "Alex Chen", handle: "alexchen", mutuals: 3, avatar: "/avatar-placeholder.svg" },
    { id: "u2", name: "Mina Park", handle: "minap", mutuals: 2, avatar: "/avatar-placeholder.svg" },
    { id: "u3", name: "Samir Khan", handle: "samirk", mutuals: 4, avatar: "/avatar-placeholder.svg" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 w-full border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserPlusIcon className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">New Connections</h2>
        </div>
        <button className="text-xs text-gray-500 hover:text-orange-600">View all</button>
      </div>

      <ul className="space-y-3">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Image src={p.avatar} alt="" width={32} height={32} className="rounded-full bg-gray-100" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                <div className="text-xs text-gray-500 truncate">@{p.handle} · {p.mutuals} mutuals</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-md bg-orange-500 text-white text-xs font-medium hover:bg-orange-600">Connect</button>
              <button className="px-3 py-1.5 rounded-md border border-gray-200 text-xs text-gray-700 hover:border-gray-300">Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

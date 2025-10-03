"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AgentRow {
  agentId: string;
  agentName: string;
  totalSkills: number;
  totalMemories: number;
  totalFed: number;
}

export default function AgentsOverview() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [filter, setFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/agents/training/stats", { cache: "no-store" });
      const j = await r.json();
      const items: AgentRow[] = (j?.byAgent || []).map((a: any) => ({
        agentId: a.agentId,
        agentName: a.agentName,
        totalSkills: a.totalSkills || 0,
        totalMemories: a.totalMemories || 0,
        totalFed: a.totalFed || 0,
      }));
      setRows(items);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    !filter.trim() || r.agentName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Agents Overview</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by agent name..."
              value={filter}
              onChange={e=> setFilter(e.target.value)}
              className="w-64"
            />
            <button
              onClick={load}
              className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
              disabled={isLoading}
            >{isLoading ? "Refreshing..." : "Refresh"}</button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Discovered Subjects</th>
                <th className="py-2 pr-4">Memories</th>
                <th className="py-2 pr-4">Fed (recent)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.agentId} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4">{r.agentName}</td>
                  <td className="py-2 pr-4">{r.totalSkills}</td>
                  <td className="py-2 pr-4">{r.totalMemories}</td>
                  <td className="py-2 pr-4">{r.totalFed}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={4}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";
import React, { useEffect, useMemo, useState } from "react";
import MediaTile, { Media } from "./MediaTile";

export default function GalleryGrid({ onOpen }: { onOpen: (m: Media) => void }) {
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  async function load(reset = false) {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (query.trim()) qp.set("query", query.trim());
      if (!reset && nextCursor) qp.set("cursor", nextCursor);
      const res = await fetch(`/api/media?${qp.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      const list: Media[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
      setItems((prev) => (reset ? list : prev.concat(list)));
      setNextCursor(typeof j?.nextCursor === "string" ? j.nextCursor : undefined);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, []);

  const onRename = async (m: Media) => {
    const title = prompt("Rename media", m.title || "Untitled");
    if (title == null) return;
    await fetch(`/api/media/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, title } : x)));
  };
  const onToggleHidden = async (m: Media) => {
    await fetch(`/api/media/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: !m.hidden }) });
    setItems((prev) => prev.filter((x) => x.id !== m.id));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or #tag"
          className="w-full border border-[#E6E8EC] rounded-md px-3 py-2 text-sm"
        />
        <button className="px-3 py-2 rounded-md border border-[#E6E8EC] text-sm" onClick={() => { setNextCursor(undefined); load(true); }}>Search</button>
        <button className="px-3 py-2 rounded-md border border-[#E6E8EC] text-sm" onClick={() => { setQuery(""); setNextCursor(undefined); load(true); }}>Refresh</button>
      </div>
      {error ? <div className="text-sm text-red-600 mb-2">{error}</div> : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((m) => (
          <MediaTile key={m.id} m={m} onOpen={onOpen} onRename={onRename} onToggleHidden={onToggleHidden} />
        ))}
      </div>
      <div className="mt-4 text-center">
        {nextCursor ? (
          <button className="px-3 py-2 rounded-md border border-[#E6E8EC] text-sm" onClick={() => load(false)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

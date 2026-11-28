'use client'

import { useMemo, useState } from 'react'

const TYPES = ['text', 'image', 'clip', 'video', 'article', 'audio'] as const
type Kind = (typeof TYPES)[number] | 'all'

const LABELS: Record<(typeof TYPES)[number], string> = {
  text: 'Text',
  image: 'Image',
  clip: 'Clip',
  video: 'Video',
  article: 'Article',
  audio: 'Audio'
}

export type ReadyGroup = { id: string; name: string }

export type ReadyItem = {
  id: string
  groupId: string
  at: string
  type: (typeof TYPES)[number]
  title: string
  url: string
}

function cellCount(items: ReadyItem[], groupId: string, type: Kind): number {
  return items.filter((item) => item.groupId === groupId && (type === 'all' || item.type === type)).length
}

export default function ReadyBoard({ groups, items, now }: { groups: ReadyGroup[]; items: ReadyItem[]; now: number }) {
  const [hours, setHours] = useState(24)
  const [picked, setPicked] = useState<{ groupId: string; type: Kind } | null>(null)
  const cutoff = now - hours * 60 * 60 * 1000
  const shown = useMemo(() => items.filter((item) => Date.parse(item.at) >= cutoff), [items, cutoff])
  const active = groups.filter((group) => shown.some((item) => item.groupId === group.id)).length
  const selected = picked ? groups.find((group) => group.id === picked.groupId) : null
  const detail = picked ? shown.filter((item) => item.groupId === picked.groupId && (picked.type === 'all' || item.type === picked.type)) : []

  const open = (groupId: string, type: Kind, count: number) => {
    if (count < 1) return
    setPicked((current) => (current?.groupId === groupId && current.type === type ? null : { groupId, type }))
  }

  return (
    <div>
      <label className="mt-6 block text-sm text-[#44403C]" htmlFor="ready-hours">
        Last <span className="font-semibold tabular-nums text-[#0B0B0F]">{hours}</span> {hours === 1 ? 'hour' : 'hours'}
      </label>
      <input
        id="ready-hours"
        className="mt-2 h-2 w-full cursor-pointer accent-[#FF6A00]"
        type="range"
        min={1}
        max={72}
        step={1}
        value={hours}
        onChange={(event) => setHours(Number(event.target.value))}
      />
      <div className="mt-1 flex justify-between text-xs text-[#78716C]">
        <span>1 hour</span>
        <span>72 hours</span>
      </div>
      <p className="mt-4 text-sm text-[#44403C]">
        {active} of {groups.length} groups have something saved in this window. {shown.length} posts.
      </p>
      <div className="mt-4 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-x-auto rounded-2xl border border-[#E6E8EC] bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[#FAFAF8] text-xs uppercase tracking-wide text-[#78716C]">
              <tr>
                <th className="px-3 py-3 font-semibold">Group</th>
                {TYPES.map((type) => (
                  <th key={type} className="px-3 py-3 text-right font-semibold">{LABELS[type]}</th>
                ))}
                <th className="px-3 py-3 text-right font-semibold">All</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const total = cellCount(shown, group.id, 'all')
                return (
                  <tr key={group.id} className="border-t border-[#F0EEEA]">
                    <th className="px-3 py-2 text-left font-medium text-[#0B0B0F]">{group.name}</th>
                    {TYPES.map((type) => {
                      const count = cellCount(shown, group.id, type)
                      const on = picked?.groupId === group.id && picked.type === type
                      return (
                        <td key={type} className="px-3 py-2 text-right tabular-nums">
                          {count < 1 ? (
                            <span className="text-[#D6D3D1]">-</span>
                          ) : (
                            <button
                              type="button"
                              className={`underline decoration-[#FF6A00] underline-offset-2 ${on ? 'font-semibold text-[#FF6A00]' : 'text-[#0B0B0F]'}`}
                              onClick={() => open(group.id, type, count)}
                            >
                              {count}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right tabular-nums">
                      {total < 1 ? (
                        <span className="text-[#D6D3D1]">-</span>
                      ) : (
                        <button
                          type="button"
                          className={`underline decoration-[#FF6A00] underline-offset-2 ${picked?.groupId === group.id && picked.type === 'all' ? 'font-semibold text-[#FF6A00]' : 'text-[#0B0B0F]'}`}
                          onClick={() => open(group.id, 'all', total)}
                        >
                          {total}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <aside className="rounded-2xl border border-[#E6E8EC] bg-white p-4 xl:sticky xl:top-6">
          {!selected || !picked ? (
            <p className="text-sm text-[#57534E]">Choose a number to read what that group saved.</p>
          ) : detail.length === 0 ? (
            <p className="text-sm text-[#57534E]">Nothing in this window for {selected.name}.</p>
          ) : (
            <div>
              <h2 className="text-base font-semibold text-[#0B0B0F]">
                {selected.name}
                <span className="ml-2 text-sm font-normal text-[#57534E]">
                  {picked.type === 'all' ? 'All types' : LABELS[picked.type]}
                </span>
              </h2>
              <ul className="mt-3 space-y-3">
                {detail.map((item) => (
                  <li key={item.id} className="border-t border-[#F0EEEA] pt-3 text-sm">
                    <p className="text-xs text-[#78716C]">
                      {item.at.slice(0, 16).replace('T', ' ')} UTC · {LABELS[item.type]}
                    </p>
                    <p className="mt-1 text-[#1C1917]">{item.title || 'No words on this post.'}</p>
                    {item.url ? (
                      <a className="mt-1 block break-all text-[#FF6A00] underline" href={item.url} target="_blank" rel="noreferrer">
                        {item.url}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

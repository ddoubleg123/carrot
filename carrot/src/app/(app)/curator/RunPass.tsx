'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RunPass() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setNote('Reading the next desks. A pass takes a minute or two.')
          const response = await fetch('/api/curator', { method: 'POST' })
          setBusy(false)
          if (!response.ok) {
            setNote('That pass did not finish.')
            return
          }
          setNote('Pass finished.')
          router.refresh()
        }}
        className="rounded-full bg-[#1C1917] px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {busy ? 'Reading…' : 'Run the next desks'}
      </button>
      {note && <p className="mt-2 text-sm text-[#57534E]">{note}</p>}
    </div>
  )
}

/** The same bar on every quote card and every post a desk makes. */
export default function MadeMark() {
  return (
    <div className="flex items-center gap-2.5 bg-[#1C1917] px-3.5 py-2 text-[#F4F1EA]">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden">
        <img src="/carrot-logo.png" alt="" width={64} height={64} className="h-16 w-16 max-w-none object-contain" />
      </span>
      <span className="text-[13px] font-medium tracking-[0.04em]">gotcarrot.com</span>
    </div>
  )
}

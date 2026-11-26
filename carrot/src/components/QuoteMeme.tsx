/** The sentence set on the photograph. The words stay type. The picture stays the real photo. */
export default function QuoteMeme({
  sentence,
  source,
  image,
  onClick,
}: {
  sentence: string
  source?: string
  image?: string | null
  onClick?: () => void
}) {
  return (
    <div
      className="relative cursor-pointer overflow-hidden rounded-2xl bg-black"
      onClick={onClick}
    >
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.82) 36%, rgba(0,0,0,.22) 64%, rgba(0,0,0,0) 82%)',
        }}
      />
      <div className="relative flex min-h-[460px] flex-col justify-end px-5 pb-5 pt-28 text-white">
        <p className="font-serif text-[1.45rem] leading-snug sm:text-[1.65rem]">“{sentence}”</p>
        {source ? (
          <p className="mt-4 border-t border-white/30 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
            {source}
          </p>
        ) : null}
      </div>
    </div>
  )
}

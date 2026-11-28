'use client'

import { useState } from 'react'
import Link from 'next/link'

export const portraitClass = 'group relative aspect-[1/2] w-full overflow-hidden rounded-md bg-[#141414] text-left shadow-md transition duration-200 hover:z-10 hover:scale-[1.04] hover:shadow-xl'

function photosOf(image?: string | string[] | null): string[] {
  return (Array.isArray(image) ? image : [image]).filter((item): item is string => Boolean(item))
}

function Frame({ image, title, byline, meta }: { image?: string | string[] | null; title: string; byline?: string; meta?: string }) {
  const photos = photosOf(image)
  const [index, setIndex] = useState(0)
  const current = photos[index]
  return (
    <>
      {current ? (
        <img
          src={current}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover object-[center_18%] transition duration-300 group-hover:scale-105"
          onError={() => setIndex((value) => value + 1)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F2937] via-[#7C2D12] to-[#FF6A00]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{title}</h3>
        {byline ? <p className="mt-2 truncate text-[11px] text-white/80">{byline}</p> : null}
        {meta ? <p className="mt-1 truncate text-[11px] text-white/80">{meta}</p> : null}
      </div>
    </>
  )
}

export function PortraitGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${className}`}>{children}</div>
}

export function PortraitCard({
  href,
  onClick,
  image,
  title,
  byline,
  meta
}: {
  href?: string
  onClick?: (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void
  image?: string | string[] | null
  title: string
  byline?: string
  meta?: string
}) {
  const frame = <Frame image={image} title={title} byline={byline} meta={meta} />
  if (!href) {
    return (
      <button type="button" onClick={onClick} className={portraitClass}>
        {frame}
      </button>
    )
  }
  return (
    <Link href={href} onClick={onClick} className={portraitClass}>
      {frame}
    </Link>
  )
}

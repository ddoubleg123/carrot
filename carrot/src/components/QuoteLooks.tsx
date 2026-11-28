import localFont from 'next/font/local'
import MadeMark from '@/components/MadeMark'
import { numberSpan, pickQuoteLook, type QuoteLook } from '@/lib/curator/quoteCardPick'

const instrument = localFont({
  src: [
    { path: '../../quote-review/kit/kit/fonts/InstrumentSerif-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../quote-review/kit/kit/fonts/InstrumentSerif-Italic.ttf', weight: '400', style: 'italic' }
  ]
})
const fraunces = localFont({ src: '../../quote-review/kit/kit/fonts/Fraunces.ttf' })
const anton = localFont({ src: '../../quote-review/kit/kit/fonts/Anton-Regular.ttf' })
const grotesk = localFont({ src: '../../quote-review/kit/kit/fonts/SpaceGrotesk.ttf' })
const plex = localFont({ src: '../../quote-review/kit/kit/fonts/IBMPlexMono-Medium.ttf' })
const oswald = localFont({ src: '../../quote-review/kit/kit/fonts/Oswald.ttf' })

type Ink = { bg: string; ink: string; acc: string; tint: string }

const PAL: Record<QuoteLook, Ink[]> = {
  documentary: [
    { bg: '#000', ink: '#fff', acc: '#e4572e', tint: 'rgba(0,0,0,.78)' },
    { bg: '#000', ink: '#fff', acc: '#f2c14e', tint: 'rgba(0,0,0,.78)' },
    { bg: '#000', ink: '#fff', acc: '#7fd1b9', tint: 'rgba(0,0,0,.78)' }
  ],
  duotone: [
    { bg: '#10182b', ink: '#fff6e5', acc: '#f0b44c', tint: 'rgba(16,24,43,.88)' },
    { bg: '#2a0c1f', ink: '#fff1ea', acc: '#ffd2c2', tint: 'rgba(42,12,31,.88)' },
    { bg: '#06231f', ink: '#f2fff6', acc: '#b9e3c6', tint: 'rgba(6,35,31,.88)' }
  ],
  editorial: [
    { bg: '#f3eee4', ink: '#191714', acc: '#b2361c', tint: 'rgba(243,238,228,.94)' },
    { bg: '#eef0ea', ink: '#141a17', acc: '#2f6b4f', tint: 'rgba(238,240,234,.94)' },
    { bg: '#f1ece8', ink: '#1b1522', acc: '#5b3fa0', tint: 'rgba(241,236,232,.94)' }
  ],
  stat: [
    { bg: '#0f0f0f', ink: '#f4f1ea', acc: '#ff5a36', tint: 'rgba(15,15,15,.9)' },
    { bg: '#f4f1ea', ink: '#111111', acc: '#1747d8', tint: 'rgba(244,241,234,.92)' },
    { bg: '#122620', ink: '#eaf4ee', acc: '#c6f26b', tint: 'rgba(18,38,32,.9)' }
  ],
  typeonly: [
    { bg: '#ff5a36', ink: '#120d0a', acc: '#120d0a', tint: 'rgba(255,90,54,.94)' },
    { bg: '#e9e4d4', ink: '#121212', acc: '#9a3412', tint: 'rgba(233,228,212,.94)' },
    { bg: '#1b2a4a', ink: '#f3efe6', acc: '#f5d76e', tint: 'rgba(27,42,74,.92)' }
  ],
  cinematic: [
    { bg: '#060606', ink: '#f4f1ea', acc: '#f5d76e', tint: 'rgba(6,6,6,.9)' },
    { bg: '#060606', ink: '#f4f1ea', acc: '#ffffff', tint: 'rgba(6,6,6,.9)' }
  ],
  backdrop: [
    { bg: '#000', ink: '#fff', acc: '#9ad1ff', tint: 'rgba(8,10,20,.72)' },
    { bg: '#000', ink: '#fff', acc: '#ffb38a', tint: 'rgba(30,10,4,.72)' }
  ],
  pullquote: [
    { bg: '#f5efe3', ink: '#1a1612', acc: '#d1495b', tint: 'rgba(245,239,227,.94)' },
    { bg: '#0e1a2b', ink: '#f2ede4', acc: '#edae49', tint: 'rgba(14,26,43,.92)' },
    { bg: '#ecefe9', ink: '#17201b', acc: '#00798c', tint: 'rgba(236,239,233,.94)' }
  ]
}

const FACE: Record<QuoteLook, string> = {
  documentary: instrument.className,
  duotone: oswald.className,
  editorial: fraunces.className,
  stat: grotesk.className,
  typeonly: grotesk.className,
  cinematic: `${instrument.className} italic text-center`,
  backdrop: grotesk.className,
  pullquote: fraunces.className
}

export default function QuoteLooks({
  sentence,
  source,
  date,
  image,
  seed
}: {
  sentence: string
  source?: string
  date?: string
  image?: string | null
  seed: string
}) {
  const who = (source || '').trim()
  const when = (date || '').trim()
  const sharp = Boolean(image && !/curator-thumbs|googleusercontent/i.test(image))
  const { look, palette } = pickQuoteLook(seed, sentence, sharp)
  const ink = PAL[look][palette % PAL[look].length]
  const figure = numberSpan(sentence)
  const quote = `“${sentence}”`

  return (
    <article className="relative isolate min-h-[520px] w-full overflow-hidden rounded-2xl" style={{ background: ink.bg, color: ink.ink }}>
      {image ? (
        <img
          src={image}
          alt=""
          className={look === 'backdrop' ? 'absolute inset-0 h-full w-full scale-110 object-cover blur-md' : 'absolute inset-0 h-full w-full object-cover'}
        />
      ) : null}
      {look === 'cinematic' && image ? (
        <img src={image} alt="" className="absolute left-0 right-0 top-[18%] h-[38%] w-full object-cover" />
      ) : null}
      <div className="absolute inset-0" style={{ background: look === 'cinematic' ? 'linear-gradient(to bottom, rgba(0,0,0,.2) 0%, rgba(0,0,0,.15) 42%, rgba(0,0,0,.92) 58%)' : `linear-gradient(to top, ${ink.tint} 0%, ${ink.tint} 46%, rgba(0,0,0,.15) 78%)` }} />
      <div className="relative flex min-h-[520px] flex-col justify-end px-5 pb-6 pt-16">
        {look === 'stat' && figure ? (
          <p className={`${anton.className} mb-3 text-[4rem] leading-none`} style={{ color: ink.acc }}>{figure}</p>
        ) : null}
        {look === 'pullquote' ? (
          <p className={`${fraunces.className} mb-1 text-[5rem] leading-none`} style={{ color: ink.acc }}>“</p>
        ) : null}
        <p className={`${FACE[look]} text-[1.45rem] leading-snug`}>{look === 'pullquote' ? sentence : quote}</p>
        <div className="mt-4 rounded-xl px-4 py-3" style={{ background: ink.bg, color: ink.ink }}>
          <p className={`${grotesk.className} text-[18px] font-semibold leading-tight`}>{who}</p>
          {when ? <p className={`${plex.className} mt-1 text-[15px] leading-tight`}>{when}</p> : null}
        </div>
      </div>
      <div className="relative z-10">
        <MadeMark />
      </div>
    </article>
  )
}

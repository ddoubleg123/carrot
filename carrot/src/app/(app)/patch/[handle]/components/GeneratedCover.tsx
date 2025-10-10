import { Globe, FileText, Play, FileText as Pdf } from 'lucide-react'

type Props = { 
  domain: string
  type: 'article' | 'video' | 'pdf' | 'image' | 'text'
  dominant?: string 
}

const iconMap = { 
  article: FileText, 
  video: Play, 
  pdf: Pdf, 
  image: FileText, 
  text: FileText 
}

/**
 * Tasteful generated cover with NO LETTERS.
 * Uses gradients, subtle patterns, and small icons only.
 */
export default function GeneratedCover({ domain, type, dominant = '#0A5AFF' }: Props) {
  const Icon = iconMap[type] ?? FileText
  
  return (
    <div className="h-full w-full relative rounded-xl overflow-hidden">
      {/* Gradient background with subtle overlay pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            `linear-gradient(135deg, ${dominant}, #0B0B0F 85%), radial-gradient(1200px 600px at 0% 100%, rgba(255,255,255,0.06), transparent)`,
          backgroundBlendMode: 'overlay, normal'
        }}
      />
      
      {/* Type badge - top left */}
      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/12 backdrop-blur px-2.5 py-1 text-white text-xs">
        <Icon className="h-3.5 w-3.5" />
        <span className="capitalize">{type}</span>
      </div>
      
      {/* Domain chip - bottom left */}
      <div className="absolute left-3 bottom-3 inline-flex items-center gap-2 rounded-full bg-white/85 px-2.5 py-1 text-[12px] text-slate-800">
        <Globe className="h-3.5 w-3.5 text-slate-600" />
        <span className="font-medium">{domain}</span>
      </div>
    </div>
  )
}


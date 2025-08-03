// src/app/test-composer/icons.tsx
// Unified icon set using Heroicons (outline)

// 1. Upload image/video (blue)
export const IconPhoto = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 44 44" className="w-9 h-9">
    <circle cx="22" cy="22" r="20" fill="#3B82F6"/>
    {/* Camera body */}
    <rect x="12" y="16" width="20" height="14" rx="4" fill="#fff"/>
    {/* Camera lens */}
    <circle cx="22" cy="23" r="4" fill="#3B82F6"/>
    {/* Camera top */}
    <rect x="17" y="13" width="10" height="5" rx="2" fill="#fff"/>
  </svg>
);
// 2. GIF (purple)
export const IconGif = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 44 44" className="w-9 h-9">
    <circle cx="22" cy="22" r="20" fill="#A78BFA"/>
    <text
      x="22"
      y="28"
      textAnchor="middle"
      fontSize="16"
      fontWeight="bold"
      fontFamily="sans-serif"
      fill="#fff"
      dominantBaseline="middle"
    >
      GIF
    </text>
  </svg>
);
// 3. Emoji (yellow)
export const IconEmoji = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 44 44" className="w-9 h-9">
    <circle cx="22" cy="22" r="20" fill="#FACC15"/>
    {/* Smile mouth */}
    <path d="M16 26 Q22 32 28 26" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* Eyes */}
    <circle cx="18" cy="20" r="2" fill="#fff"/>
    <circle cx="26" cy="20" r="2" fill="#fff"/>
  </svg>
);
// 4. Audio note (green)
export const IconAudio = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 44 44" className="w-9 h-9">
    <circle cx="22" cy="22" r="20" fill="#34D399"/>
    {/* Modern mic body */}
    <rect x="18" y="15" width="8" height="14" rx="4" fill="#fff"/>
    {/* Mic head */}
    <ellipse cx="22" cy="18" rx="4" ry="4" fill="#fff"/>
    {/* Mic stem */}
    <rect x="21" y="29" width="2" height="6" rx="1" fill="#fff"/>
    {/* Mic base */}
    <rect x="19" y="35" width="6" height="2" rx="1" fill="#fff"/>
    {/* Sound waves */}
    <path d="M15 20 Q12 26 15 32" stroke="#fff" strokeWidth="1.5" fill="none"/>
    <path d="M29 20 Q32 26 29 32" stroke="#fff" strokeWidth="1.5" fill="none"/>
  </svg>
);
// 5. Commitment (orange carrot in circle)
export const IconCarrot = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 44 44" className="w-9 h-9">
    <circle cx="22" cy="22" r="20" fill="#FB923C"/>
    {/* Fat carrot body */}
    <polygon points="22,34 18,18 26,18" fill="#fff176" stroke="#ff9800" strokeWidth="2"/>
    {/* Carrot leaves */}
    <path d="M22 18 L17 11 M22 18 L27 13" stroke="#43a047" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
// 6. Boost post (pink)
export const IconLightning = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 44 44" className="w-9 h-9">
    <circle cx="22" cy="22" r="20" fill="#fde047"/>
    {/* Lightning bolt */}
    <polygon points="25,10 14,26 22,26 19,34 32,18 24,18" fill="#fff" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

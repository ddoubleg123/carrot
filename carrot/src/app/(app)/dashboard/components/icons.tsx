// Icon components for CommitmentComposer - Clean simple style matching carrot reference
// Solid colored circles with simple white icons inside, like the carrot and purple icons shown

export const IconPhoto = () => (
  <svg className="w-8 h-8 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none">
    {/* Blue circular background */}
    <circle cx="12" cy="12" r="11" fill="#3B82F6"/>
    {/* Simple camera icon in white */}
    <rect x="7" y="9" width="10" height="7" rx="1" fill="white"/>
    <circle cx="12" cy="12.5" r="2" fill="#3B82F6"/>
    <circle cx="12" cy="12.5" r="1" fill="white"/>
    <rect x="15" y="10" width="1" height="1" fill="#3B82F6"/>
  </svg>
);

export const IconGif = () => (
  <svg className="w-8 h-8 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none">
    {/* Purple circular background */}
    <circle cx="12" cy="12" r="11" fill="#8B5CF6"/>
    {/* Simple GIF text in white */}
    <text x="12" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial, sans-serif">GIF</text>
  </svg>
);

export const IconEmoji = () => (
  <svg className="w-8 h-8 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none">
    {/* Yellow circular background */}
    <circle cx="12" cy="12" r="11" fill="#F59E0B"/>
    {/* Simple smiley face in white */}
    <circle cx="9.5" cy="10.5" r="0.8" fill="white"/>
    <circle cx="14.5" cy="10.5" r="0.8" fill="white"/>
    <path d="M8.5 13.5c1 1.5 2.5 2 3.5 2s2.5-0.5 3.5-2" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </svg>
);

export const IconAudio = () => (
  <svg className="w-8 h-8 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none">
    {/* Red circular background */}
    <circle cx="12" cy="12" r="11" fill="#EF4444"/>
    {/* Simple microphone in white */}
    <rect x="10.5" y="8" width="3" height="4" rx="1.5" fill="white"/>
    <rect x="11.7" y="12" width="0.6" height="2.5" fill="white"/>
    <rect x="9.5" y="14.5" width="5" height="0.8" rx="0.4" fill="white"/>
  </svg>
);

export const IconCarrot = () => (
  <svg className="w-8 h-8 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none">
    {/* Orange circular background - matches reference exactly */}
    <circle cx="12" cy="12" r="11" fill="#F97316"/>
    {/* Simple carrot in white */}
    <path d="M9 15c0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.66-1.34-3-3-3s-3 1.34-3 3z" fill="white"/>
    {/* Green leaves */}
    <path d="M11 9l1-2 1 2-1 1-1-1z" fill="#22C55E"/>
  </svg>
);

export const IconLightning = () => (
  <svg className="w-8 h-8 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none">
    {/* Yellow circular background */}
    <circle cx="12" cy="12" r="11" fill="#FBBF24"/>
    {/* Simple lightning bolt in white */}
    <path d="M13 7L9 13h3l-1 4 4-6h-3l1-4z" fill="white"/>
  </svg>
);

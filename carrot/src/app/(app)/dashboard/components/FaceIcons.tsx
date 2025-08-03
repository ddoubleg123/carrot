import React from 'react';

export const SadFaceIcon = ({ selected = false, ...props }: { selected?: boolean; className?: string }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" {...props}>
    <circle cx="16" cy="16" r="14" stroke="#555" strokeWidth="2.5" fill="none" />
    <ellipse cx="11.5" cy="14" rx="1.5" ry="2" fill="#555" />
    <ellipse cx="20.5" cy="14" rx="1.5" ry="2" fill="#555" />
    <path d="M12.5 21c1.5-2 5.5-2 7 0" stroke="#555" strokeWidth="2" fill="none" />
    {selected && <circle cx="16" cy="16" r="14" stroke="#0070f3" strokeWidth="3" fill="none" />} 
  </svg>
);

export const NeutralFaceIcon = ({ selected = false, ...props }: { selected?: boolean; className?: string }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" {...props}>
    <circle cx="16" cy="16" r="14" stroke="#555" strokeWidth="2.5" fill="none" />
    <ellipse cx="11.5" cy="14" rx="1.5" ry="2" fill="#555" />
    <ellipse cx="20.5" cy="14" rx="1.5" ry="2" fill="#555" />
    <rect x="12" y="21" width="8" height="2" rx="1" fill="#555" />
    {selected && <circle cx="16" cy="16" r="14" stroke="#0070f3" strokeWidth="3" fill="none" />} 
  </svg>
);

export const HappyFaceIcon = ({ selected = false, ...props }: { selected?: boolean; className?: string }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" {...props}>
    <circle cx="16" cy="16" r="14" stroke="#555" strokeWidth="2.5" fill="none" />
    <ellipse cx="11.5" cy="14" rx="1.5" ry="2" fill="#555" />
    <ellipse cx="20.5" cy="14" rx="1.5" ry="2" fill="#555" />
    <path d="M12.5 20c1.5 2 5.5 2 7 0" stroke="#555" strokeWidth="2" fill="none" />
    {selected && <circle cx="16" cy="16" r="14" stroke="#0070f3" strokeWidth="3" fill="none" />} 
  </svg>
);

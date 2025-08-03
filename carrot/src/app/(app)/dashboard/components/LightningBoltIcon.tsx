import React from 'react';

export default function LightningBoltIcon({ className = '', size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2L3 15h8l-1 11 10-13h-8l1-11z"
        fill="#fbbf24"
        stroke="#f59e42"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

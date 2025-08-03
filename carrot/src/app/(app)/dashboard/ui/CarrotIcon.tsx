import React from 'react';

// Simple carrot icon SVG component
export function CarrotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16.06 3.56L21.19 8.69C22.45 9.95 22.45 12.05 21.19 13.31L13.31 21.19C12.05 22.45 9.95 22.45 8.69 21.19L3.56 16.06C2.3 14.8 2.3 12.7 3.56 11.44L11.44 3.56C12.7 2.3 14.8 2.3 16.06 3.56Z"
        fill="currentColor"
      />
      <path
        d="M19.78 4.22C20.07 4.51 20.07 4.99 19.78 5.28L5.28 19.78C4.99 20.07 4.51 20.07 4.22 19.78C3.93 19.49 3.93 19.01 4.22 18.72L18.72 4.22C19.01 3.93 19.49 3.93 19.78 4.22Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default CarrotIcon;

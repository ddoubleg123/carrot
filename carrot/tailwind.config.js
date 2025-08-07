/** @type {import('tailwindcss').Config} */
module.exports = {
  safelist: [
    'text-gray-900',
    'font-bold',
    'text-4xl',
    'text-5xl',
    'text-2xl',
    'text-3xl',
    'md:text-5xl',
    'md:text-4xl',
    'md:text-3xl',
  ],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      transitionProperty: { 
        width: 'width',
        'max-height': 'max-height',
        'opacity': 'opacity',
        'transform': 'transform'
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        float: 'float 4s ease-in-out infinite',
        'fade-in': 'fade-in 200ms ease-out forwards',
        'scale-in': 'scale-in 200ms ease-out forwards',
      },
      keyframes: {
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        'scale-in': {
          from: { opacity: 0, transform: 'scale(0.95)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      colors: {
        primary: {
          DEFAULT: "#F47C23", // Carrot orange
          dark: "#E55E2B",
        },
        secondary: {
          DEFAULT: "#2D3748", // Dark gray
          light: "#4A5568",
        },
        accent: {
          DEFAULT: "#E03D3D", // Stick red
          light: "#FC8181",
        },
        background: "#F7FAFC",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      screens: {
        'sm': '0px',      // <640px  = mobile
        'md': '640px',    // 640-1023 = tablet
        'lg': '1024px',   // 1024-1279 = small desktop
        'xl': '1280px',   // ≥1280 = large desktop
      },
    },
  },
  plugins: [],
}

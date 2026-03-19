/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Surface colors are CSS-variable driven → automatic dark/light switching
        surface: {
          DEFAULT: 'var(--c-bg)',
          50:  'var(--c-surface)',
          100: 'var(--c-surface-1)',
          200: 'var(--c-surface-2)',
          300: 'var(--c-surface-3)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow:       '0 0 24px rgba(99,102,241,0.35)',
        'glow-sm':  '0 0 12px rgba(99,102,241,0.2)',
        elevated:   '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.25)',
      },
      animation: {
        shimmer:   'shimmer 1.4s ease infinite',
        'fade-in': 'fadeIn 0.25s ease',
        'slide-up':'slideUp 0.25s ease',
        'ping-slow':'ping 2.5s cubic-bezier(0,0,0.2,1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

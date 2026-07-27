/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1628',
          soft: '#152238',
          muted: '#2A3A52',
        },
        gold: {
          DEFAULT: '#B8954A',
          light: '#D4B86A',
          dark: '#8F7135',
        },
        ivory: {
          DEFAULT: '#F8F5EF',
          warm: '#EFE9DC',
        },
        ink: '#1A1A1A',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 40px rgba(11, 22, 40, 0.08)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.8s ease-out both',
        'fade-up-delay': 'fade-up 0.8s ease-out 0.15s both',
        'fade-up-delay-2': 'fade-up 0.8s ease-out 0.3s both',
        'fade-in': 'fade-in 1s ease-out both',
      },
    },
  },
  plugins: [],
}

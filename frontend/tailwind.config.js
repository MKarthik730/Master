/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          900: '#0B0D10',
          800: '#14171C',
          700: '#1A1E26',
          600: '#242830',
          500: '#2E3440',
          400: '#3B4252',
          300: '#4C566A',
          200: '#6C7A96',
          100: '#8F9BB3',
        },
        accent: {
          DEFAULT: '#6C63FF',
          light: '#8B85FF',
          dark: '#5549E0',
          glow: 'rgba(108, 99, 255, 0.25)',
        },
        amber: {
          DEFAULT: '#F5A623',
          light: '#FFC04D',
          glow: 'rgba(245, 166, 35, 0.25)',
        },
        surface: {
          DEFAULT: '#14171C',
          alt: '#1A1E26',
          hover: '#242830',
          border: '#242830',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-amber': 'pulseAmber 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseAmber: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(245, 166, 35, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

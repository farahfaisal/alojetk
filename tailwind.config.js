/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand': {
          DEFAULT: '#c21d14',
          light: '#d63031',
          dark: '#a71e1e'
        },
        'accent': {
          DEFAULT: '#ffffff',
          light: '#f8f9fa',
          dark: '#e9ecef'
        }
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Cairo', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-shadow': 'pulse-shadow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
      },
      boxShadow: {
        'neumorphic': '8px 8px 16px rgba(0, 0, 0, 0.1), -8px -8px 16px rgba(255, 255, 255, 0.7)',
        'neumorphic-inset': 'inset 4px 4px 8px rgba(0, 0, 0, 0.1), inset -4px -4px 8px rgba(255, 255, 255, 0.7)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      maxWidth: {
        'screen': '100vw',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.no-horizontal-scroll': {
          'overflow-x': 'hidden',
          'max-width': '100vw',
          'touch-action': 'pan-y',
        },
        '.lock-viewport': {
          'position': 'relative',
          'width': '100%',
          'max-width': '100vw',
          'overflow-x': 'hidden',
        },
      })
    },
  ],
};
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        galentix: {
          50: '#edfcf5',
          100: '#d3f8e6',
          200: '#aaf0d1',
          300: '#6bbf9e', // Primary brand color
          400: '#4aab89',
          500: '#2d8f70',
          600: '#1f735a',
          700: '#1a5c49',
          800: '#17493b',
          900: '#143d32',
          950: '#0a221c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

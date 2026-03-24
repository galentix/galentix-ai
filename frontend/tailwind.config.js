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
          50: '#f0faf6',
          100: '#d1f2e4',
          200: '#a3e5c9',
          300: '#6fd4aa',
          400: '#6BBF9E',  // keep close to brand
          500: '#6BBF9E',  // brand primary
          600: '#4a9f7e',
          700: '#3a7d63',
          800: '#2b5c49',
          900: '#1c3c30',
          950: '#0e1f19',
        }
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}

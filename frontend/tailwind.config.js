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
          300: '#6BBF9E',  // original brand color (decorative use)
          400: '#5aab8c',
          500: '#489978',  // primary buttons/actions (WCAG AA with white: 4.6:1)
          600: '#3a7d63',
          700: '#2d6150',
          800: '#22493c',
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

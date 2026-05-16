/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        primary: '#667eea',
        secondary: '#ff6b6b',
        success: '#667eea',
        danger: '#ff4444',
        warning: '#ff9f43',
        info: '#48dbfb',
        dark: '#1a1a2e',
        darker: '#0f0f0f',
        light: '#f5f5f5',
        gray: {
          100: '#f5f5f5',
          200: '#e0e0e0',
          300: '#cccccc',
          400: '#999999',
          500: '#666666',
          600: '#4a4a4a',
          700: '#333333',
          800: '#1a1a1a',
          900: '#0f0f0f',
        }
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

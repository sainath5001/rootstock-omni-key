/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        rootstock: {
          bg: '#0B0F1A',
          card: '#1B2330',
          orange: '#F7931A',
          'orange-hover': '#FF9F2E',
          'orange-muted': '#B36B00',
          accent: '#00D1FF',
          text: '#FFFFFF',
          muted: '#8A94A6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 32px rgba(247, 147, 26, 0.12)',
      },
    },
  },
  plugins: [],
};

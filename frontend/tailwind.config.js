/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        '6nations': {
          bg: '#0e141b',
          panel: '#161c23',
          raised: '#1a2027',
          active: '#252a32',
          border: '#3c4a42',
          emerald: '#4edea3',
          gold: '#ffb95f',
          teal: '#6bd8cb',
          text: '#dde3ed',
          muted: '#bbcabf',
        },
      },
      fontFamily: {
        display: ['Chivo_700Bold'],
        body: ['Inter_400Regular'],
      },
    },
  },
};

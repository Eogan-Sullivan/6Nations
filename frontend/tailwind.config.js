/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        '6nations': {
          bg: 'var(--bg)', panel: 'var(--panel)', raised: 'var(--raised)', active: 'var(--active)',
          border: 'var(--border)', emerald: 'var(--emerald)', gold: 'var(--gold)', teal: 'var(--teal)',
          text: 'var(--text)', muted: 'var(--muted)',
        },
      },
      fontFamily: {
        display: ['Chivo_700Bold'],
        body: ['Inter_400Regular'],
      },
    },
  },
};

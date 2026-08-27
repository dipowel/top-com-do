import type { Config } from 'tailwindcss';

export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#070b14',
        'base-2': '#0b1220',
        gold: { DEFAULT: '#D4AF37', soft: '#E8C874', deep: '#B8942A' },
        emerald: { DEFAULT: '#10B981', soft: '#34D399' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 45px -14px rgba(212,175,55,0.55)',
      },
      borderRadius: {
        '2xl': '1.15rem',
      },
    },
  },
  plugins: [],
} satisfies Config;

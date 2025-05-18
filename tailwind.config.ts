import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--error-foreground))',
        },
        neutral: {
          '50': 'hsl(var(--neutral-50))',
          '100': 'hsl(var(--neutral-100))',
          '200': 'hsl(var(--neutral-200))',
          '300': 'hsl(var(--neutral-300))',
          '400': 'hsl(var(--neutral-400))',
          '500': 'hsl(var(--neutral-500))',
          '600': 'hsl(var(--neutral-600))',
          '700': 'hsl(var(--neutral-700))',
          '800': 'hsl(var(--neutral-800))',
          '900': 'hsl(var(--neutral-900))',
        },
        surface: {
          light: 'hsl(var(--surface-light))',
          mild: 'hsl(var(--surface-mild))',
          bold: 'hsl(var(--surface-bold))',
          contrast: 'hsl(var(--surface-contrast))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        shiki: {
          light: 'var(--shiki-light)',
          'light-bg': 'var(--shiki-light-bg)',
          dark: 'var(--shiki-dark)',
          'dark-bg': 'var(--shiki-dark-bg)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'typing-dot-bounce': {
          '0%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-2px)',
          },
          '100%': {
            transform: 'translateY(0px)',
          },
          '0%,40%': {
            transform: 'translateY(0)',
          },
          '20%': {
            transform: 'translateY(-0.25rem)',
          },
        },
        'typing-1': {
          '0%, 100%': {
            opacity: '0.3',
            transform: 'translateY(0)',
          },
          '50%': {
            opacity: '0.8',
            transform: 'translateY(-1px)',
          },
        },
        'typing-2': {
          '0%, 100%': {
            opacity: '0.3',
            transform: 'translateY(0)',
          },
          '50%': {
            opacity: '0.8',
            transform: 'translateY(-1px)',
          },
        },
        'typing-3': {
          '0%, 100%': {
            opacity: '0.3',
            transform: 'translateY(0)',
          },
          '50%': {
            opacity: '0.8',
            transform: 'translateY(-1px)',
          },
        },
        loadingBar: {
          '0%': { width: '0%' },
          '50%': { width: '70%' },
          '75%': { width: '85%' },
          '90%': { width: '95%' },
          '100%': { width: '95%' },
        },
        loadingDot: {
          '0%, 60%, 100%': { opacity: '0.4', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-2px)' },
        },
        diagramFadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        progressBar: {
          '0%': { width: '0%' },
          '20%': { width: '35%' },
          '50%': { width: '65%' },
          '75%': { width: '85%' },
          '90%': { width: '95%' },
          '100%': { width: '100%' },
        },
        arrowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        diagramPulse: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(59, 130, 246, 0)' },
          '50%': { boxShadow: '0 0 6px rgba(59, 130, 246, 0.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        fadeIn: 'fadeIn 0.5s ease forwards',
        'typing-dot-bounce': 'typing-dot-bounce 1.25s ease-out infinite',
        'typing-1': 'typing-1 1s ease-in-out infinite',
        'typing-2': 'typing-2 1s ease-in-out infinite 0.2s',
        'typing-3': 'typing-3 1s ease-in-out infinite 0.4s',
        loadingBar: 'loadingBar 3s ease-in-out forwards',
        loadingDot: 'loadingDot 1.5s ease-in-out infinite',
        diagramFadeIn: 'diagramFadeIn 0.3s ease-in-out',
        progressBar: 'progressBar 3s ease-in-out forwards',
        arrowPulse: 'arrowPulse 2s infinite',
        diagramPulse: 'diagramPulse 2s infinite',
        shimmer: 'shimmer 1s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;

import { Bot } from 'lucide-react';
import { inter } from './fonts';

export const branding = {
  colors: {
    border: 'hsl(var(--border))',
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
    // Custom Branding
    brand: {
      blue: 'hsl(var(--brand-blue))',
      blueForeground: 'hsl(var(--brand-blue-foreground))',
    },
  },
  fonts: {
    sans: inter.style.fontFamily,
  },
  logo: {
    icon: Bot,
    text: 'AgentDock',
  },
};

import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

// Load Inter font
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

// Define font types
export type FontFamily = 'inter' | 'geist';

export interface FontConfig {
  name: string;
  className: string;
  fontFamily: string;
  variable: string;
}

// Font options for the application
export const fontOptions: Record<FontFamily, FontConfig> = {
  inter: {
    name: 'Inter',
    className: inter.className,
    fontFamily: inter.style.fontFamily,
    variable: '--font-inter'
  },
  geist: {
    name: 'Geist',
    className: GeistSans.className,
    fontFamily: GeistSans.style.fontFamily,
    variable: GeistSans.variable
  }
};

// Monospace font options
export const monoFonts = {
  geistMono: {
    name: 'Geist Mono',
    className: GeistMono.className,
    fontFamily: GeistMono.style.fontFamily,
    variable: GeistMono.variable
  }
};

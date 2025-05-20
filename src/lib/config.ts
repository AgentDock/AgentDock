/**
 * @fileoverview Core configuration for the AgentDock application.
 */

export const siteConfig = {
  name: 'AgentDock Hub',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://hub.agentdock.ai',
  ogImage: (process.env.NEXT_PUBLIC_APP_URL || 'https://hub.agentdock.ai') + '/api/og',
  description: 'Build Anything with AI Agents',
  links: {
    twitter: 'https://twitter.com/agentdock',
    github: 'https://github.com/agentdock',
  },
} as const;

export const metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    'AI',
    'Artificial Intelligence',
    'AI Agents',
    'LLM',
    'Machine Learning',
    'Automation',
    'Natural Language Inference',
    'AgentDock',
    'Agentic AI',
    'Workflows',
    'Agentic Framework',
  ],
  authors: [
    {
      name: 'AgentDock',
      url: siteConfig.url,
    },
  ],
  creator: 'AgentDock',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: '@agentdock',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
} as const;

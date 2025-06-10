import { FontFamily } from '@/lib/fonts';

export interface GlobalSettings {
  apiKeys: {
    openai: string;
    anthropic: string;
    gemini: string;
    deepseek: string;
    groq: string;
    [key: string]: string;
  };
  core: {
    byokOnly: boolean;
    debugMode?: boolean;
  };
  fonts: {
    primary: FontFamily;
    mono: string;
  };
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  apiKeys: {
    openai: '',
    anthropic: '',
    gemini: '',
    deepseek: '',
    groq: ''
  },
  core: {
    byokOnly: false,
    debugMode: false
  },
  fonts: {
    primary: 'inter',
    mono: 'default'
  }
};

export interface ApiKeyProvider {
  key: keyof GlobalSettings['apiKeys'];
  label: string;
  icon: React.ElementType;
  description: string;
}

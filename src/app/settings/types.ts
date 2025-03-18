export interface GlobalSettings {
  apiKeys: {
    openai: string
    anthropic: string
    gemini: string
    deepseek: string
    groq: string
    [key: string]: string
  }
  core: {
    byokOnly: boolean
    debugMode?: boolean
  }
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  apiKeys: {
    openai: "",
    anthropic: "",
    gemini: "",
    deepseek: "",
    groq: ""
  },
  core: {
    byokOnly: false,
    debugMode: false
  }
}

export interface ApiKeyProvider {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
} 
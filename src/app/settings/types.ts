export interface GlobalSettings {
  apiKeys: {
    openai: string
    anthropic: string
    serpapi: string
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
    serpapi: ""
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
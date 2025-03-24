import type { CreateMessage } from 'agentdock-core/client'

interface PromptSuggestionsProps {
  label: string
  append: (message: CreateMessage) => void | Promise<string | null | undefined>
  suggestions: string[]
}

export function PromptSuggestions({
  label,
  append,
  suggestions,
}: PromptSuggestionsProps) {
  // Simple heading with emoji
  const displayLabel = label === "Try these prompts ✨" ? "✨ Explore these options" : label;
  
  // Language-agnostic text splitter
  const splitSuggestion = (text: string) => {
    // Handle newlines first
    if (text.includes('\n')) {
      const parts = text.split('\n');
      return { main: parts[0], rest: parts.slice(1).join(' ') };
    }
    
    // Look for common breaking patterns
    const patterns = [
      /^([^.?!:]+[.?!:])\s+(.+)$/,     // Sentences ending with .?!:
      /^([^,]+,)\s+(.+)$/,             // Phrases with commas
      /^(.{15,50}(?=\s+\w+))\s+(.+)$/  // Split after 15-50 chars at a word boundary
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { main: match[1], rest: match[2] };
      }
    }
    
    // If no patterns matched and text is long, do a simple split
    if (text.length > 30) {
      const words = text.split(' ');
      const midpoint = Math.ceil(words.length / 2);
      return { 
        main: words.slice(0, midpoint).join(' '), 
        rest: words.slice(midpoint).join(' ') 
      };
    }
    
    // Default to just showing everything as main
    return { main: text, rest: '' };
  };
  
  return (
    <div className="space-y-4 mx-auto max-w-5xl">
      <h2 className="text-center text-xl font-semibold text-foreground">{displayLabel}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {suggestions.map((suggestion) => {
          const { main, rest } = splitSuggestion(suggestion);
          return (
            <button
              key={suggestion}
              onClick={() => append({ role: "user", content: suggestion })}
              className="p-5 border border-border rounded-xl text-left bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium text-card-foreground">{main}</div>
              {rest && <div className="text-muted-foreground mt-1 text-sm">{rest}</div>}
            </button>
          );
        })}
      </div>
    </div>
  )
} 
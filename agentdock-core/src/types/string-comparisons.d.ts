declare module 'string-comparisons' {
  export const SorensenDice: {
    similarity: (s1: string, s2: string) => number;
  };
  export const JaroWinkler: {
    similarity: (s1: string, s2: string) => number;
  };
  export const Levenshtein: {
    /**
     * Calculates Levenshtein distance between two strings.
     * Note: Returns a distance value (lower means more similar)
     * rather than a similarity score directly.
     */
    similarity: (s1: string, s2: string) => number; // Actually returns distance
  };
  // Add other algorithms from the library here if/when needed, for example:
  // export const Cosine: { similarity: (s1: string, s2: string) => number; };
  // export const Jaccard: { similarity: (s1: string, s2: string) => number; };
  // export const HammingDistance: { similarity: (s1: string, s2: string) => number; }; // Returns distance
} 
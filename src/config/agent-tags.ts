/**
 * @fileoverview Configuration file for agent tags and categories
 * Used for filtering and displaying agents by category
 */

export interface TagConfig {
  id: string; // URL-friendly identifier
  name: string; // Display name
  description?: string; // Optional description
  order: number; // Display order in sidebar (lower = higher)
  default?: boolean; // Is this a default category to show
  alwaysOnTop?: boolean; // Should agents in this category always be on top
}

export const AGENT_TAGS: TagConfig[] = [
  {
    id: 'featured',
    name: 'Featured',
    description: 'Our featured agents',
    order: 0,
    default: true,
    alwaysOnTop: true,
  },
  {
    id: 'health',
    name: 'Health',
    description: 'Health and medical assistants',
    order: 3,
  },
  {
    id: 'legal',
    name: 'Legal',
    description: 'Legal assistants and advisors',
    order: 3,
  },
  {
    id: 'characters',
    name: 'Characters',
    description: 'Character-based assistants',
    order: 4,
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Productivity enhancement agents',
    order: 2,
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Technical assistants and tools',
    order: 4,
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Research assistants',
    order: 1,
  },
  {
    id: 'web3',
    name: 'Web3',
    description: 'Blockchain and Web3 assistants',
    order: 9,
  },
  {
    id: 'codegen',
    name: 'CodeGen',
    description: 'Code generation and programming assistants',
    order: 7,
  },
  {
    id: 'learning',
    name: 'Learning',
    description: 'Learning and tutoring assistants',
    order: 8,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Marketing assistants and agents',
    order: 9,
  },
];

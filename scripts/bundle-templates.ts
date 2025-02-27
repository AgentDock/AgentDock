import { promises as fs } from 'fs';
import path from 'path';
import { logger, LogCategory } from 'agentdock-core';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';

async function bundleTemplates() {
  const templatesDir = path.join(process.cwd(), 'agents');
  const outputFile = path.join(process.cwd(), 'src/generated/templates.ts');

  try {
    logger.debug(
      LogCategory.CONFIG,
      'Bundling templates',
      JSON.stringify({ templatesDir })
    );

    // Read all agent directories
    const agentDirs = await fs.readdir(templatesDir);
    const templates: Record<string, any> = {};

    // Load each template
    for (const agentId of agentDirs) {
      const templatePath = path.join(templatesDir, agentId, 'template.json');
      
      try {
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        const template = JSON.parse(templateContent);
        templates[agentId] = template;
        
        logger.info(
          LogCategory.CONFIG,
          'Bundled template',
          JSON.stringify({ agentId, name: templates[agentId].name })
        );
      } catch (error) {
        logger.warn(
          LogCategory.CONFIG,
          'Failed to bundle template',
          JSON.stringify({ agentId, error: error instanceof Error ? error.message : 'Unknown error' })
        );
      }
    }

    // Generate TypeScript file
    const fileContent = `// Generated file - do not edit directly
// This file is auto-generated during build time from the agents/ directory

import { AgentConfig } from 'agentdock-core';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';

export const templates = ${JSON.stringify(templates, null, 2)} as const;

export type TemplateId = keyof typeof templates;
export type Template = typeof templates[TemplateId];

export function getTemplate(id: TemplateId): AgentConfig {
  const template = templates[id];
  
  // Create mutable copy of the template with validated personality
  const config = {
    ...template,
    personality: PersonalitySchema.parse(template.personality),
    nodes: [...template.nodes],
    chatSettings: {
      ...template.chatSettings,
      initialMessages: template.chatSettings?.initialMessages ? [...template.chatSettings.initialMessages] : []
    }
  };
  
  return config as AgentConfig;
}
`;

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, fileContent);

    logger.info(
      LogCategory.CONFIG,
      'Templates bundled successfully',
      JSON.stringify({ count: Object.keys(templates).length })
    );
  } catch (error) {
    logger.error(
      LogCategory.CONFIG,
      'Failed to bundle templates',
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
    );
    process.exit(1);
  }
}

bundleTemplates(); 
/**
 * @fileoverview Shared utilities for node handling
 */

import { NodePort } from 'agentdock-core';
import { z } from 'zod';

/**
 * Create a form schema from node ports
 */
export function createPortSchema(ports: readonly NodePort[]): z.ZodObject<any> {
  const schema: Record<string, z.ZodType<any>> = {};

  ports.forEach((port) => {
    let field: z.ZodType<any>;

    switch (port.type) {
      case 'string':
        field = port.required ? z.string().min(1) : z.string().optional();
        break;
      case 'number':
        field = port.required ? z.number() : z.number().optional();
        break;
      case 'boolean':
        field = port.required ? z.boolean() : z.boolean().optional();
        break;
      default:
        field = port.required ? z.unknown() : z.unknown().optional();
    }

    schema[port.id] = field;
  });

  return z.object(schema);
}

/**
 * Create default values from node ports
 */
export function createPortDefaults(ports: readonly NodePort[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  ports.forEach((port) => {
    if (port.defaultValue !== undefined) {
      defaults[port.id] = port.defaultValue;
    }
  });

  return defaults;
}

/**
 * Get display type for a port
 */
export function getPortDisplayType(port: NodePort): string {
  if (port.schema && typeof port.schema === 'object' && 'multiline' in port.schema) {
    return 'textarea';
  }
  return port.type;
}

/**
 * Create a port label with required indicator
 */
export function getPortLabel(port: NodePort): string {
  return `${port.label}${port.required ? ' *' : ''}`;
}

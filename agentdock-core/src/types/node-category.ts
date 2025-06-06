/**
 * @fileoverview Node category type definition
 */

export const NodeCategory = Object.freeze({
  CORE: 'core',
  CUSTOM: 'custom'
} as const);

export type NodeCategory = (typeof NodeCategory)[keyof typeof NodeCategory];

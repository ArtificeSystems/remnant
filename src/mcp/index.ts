import { parseRemnant } from '../parse.js';
import { canonicalizeRemnant, serializeRemnant } from '../serialize.js';
import type { Remnant } from '../remnant.js';

export const REMNANT_MCP_MIME = 'application/json';

export interface McpResourceContents {
  uri: string;
  mimeType: string;
  text: string;
}

export interface McpStructuredResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
}

export function toMcpResource(remnant: Remnant, options: { uri?: string } = {}): McpResourceContents {
  return {
    uri: options.uri ?? `remnant://${remnant.id}`,
    mimeType: REMNANT_MCP_MIME,
    text: serializeRemnant(remnant),
  };
}

export function toMcpStructuredContent(remnant: Remnant): McpStructuredResult {
  return {
    content: [{ type: 'text', text: serializeRemnant(remnant) }],
    structuredContent: canonicalizeRemnant(remnant),
  };
}

export function fromMcpResource(resource: { text?: string } | string): Remnant {
  const text = typeof resource === 'string' ? resource : resource.text;
  if (!text) throw new Error('MCP resource has no text payload');
  return parseRemnant(text);
}

export function fromMcpStructuredContent(value: unknown): Remnant {
  if (value && typeof value === 'object' && 'structuredContent' in value) {
    return parseRemnant((value as McpStructuredResult).structuredContent);
  }
  return parseRemnant(value);
}

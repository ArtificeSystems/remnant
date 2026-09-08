import type { Remnant } from './remnant.js';

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'pem', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi },
  { name: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'generic', re: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
];

function redactText(text: string): string {
  let next = text;
  for (const { re } of SECRET_PATTERNS) {
    next = next.replace(re, '[REDACTED]');
  }
  return next;
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactUnknown(v);
    }
    return out;
  }
  return value;
}

/** Best-effort. Not a DLP engine. */
export function redactRemnant(remnant: Remnant): Remnant {
  return redactUnknown(remnant) as Remnant;
}

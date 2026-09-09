import type { Remnant, RemnantOutput, Assumption, VerificationRecord, SideEffect, Evidence } from './remnant.js';

const REMNANT_KEYS = [
  'protocolVersion',
  'id',
  'createdAt',
  'asOf',
  'producer',
  'goal',
  'status',
  'outputs',
  'assumptions',
  'unknowns',
  'verification',
  'stop',
  'supersedes',
  'effects',
  'evidence',
  'nextAction',
  'locked',
  'authority',
  'notChecked',
  'lane',
  'extensions',
] as const;

const OUTPUT_KEYS = ['kind', 'name', 'description', 'text', 'mediaType', 'data', 'path', 'sha256', 'size', 'uri'] as const;
const ASSUMPTION_KEYS = ['statement', 'basis', 'ref'] as const;
const VERIFICATION_KEYS = ['claim', 'method', 'result', 'evidence', 'asOf', 'doesNotProve'] as const;
const EFFECT_KEYS = ['action', 'status', 'evidence', 'asOf'] as const;
const EVIDENCE_KEYS = ['type', 'claim', 'uri', 'digest', 'data'] as const;

function pick<T extends object>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as Record<string, unknown>)[key];
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

function sortRecord(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = canonicalizeValue(value[key]);
  }
  return out;
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === 'object') return sortRecord(value as Record<string, unknown>);
  return value;
}

function canonicalizeOutput(output: RemnantOutput): Record<string, unknown> {
  return pick(output, OUTPUT_KEYS);
}

function canonicalizeAssumption(assumption: Assumption): Record<string, unknown> {
  return pick(assumption, ASSUMPTION_KEYS);
}

function canonicalizeVerification(record: VerificationRecord): Record<string, unknown> {
  return pick(record, VERIFICATION_KEYS);
}

function canonicalizeEffect(effect: SideEffect): Record<string, unknown> {
  return pick(effect, EFFECT_KEYS);
}

function canonicalizeEvidence(item: Evidence): Record<string, unknown> {
  const out = pick(item, EVIDENCE_KEYS);
  if (out.data !== undefined) out.data = canonicalizeValue(out.data);
  return out;
}

export function canonicalizeRemnant(remnant: Remnant): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of REMNANT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(remnant, key)) continue;
    const value = remnant[key];
    if (value === undefined) continue;
    if (key === 'outputs') {
      out[key] = (value as RemnantOutput[]).map(canonicalizeOutput);
    } else if (key === 'assumptions') {
      out[key] = (value as Assumption[]).map(canonicalizeAssumption);
    } else if (key === 'verification') {
      out[key] = (value as VerificationRecord[]).map(canonicalizeVerification);
    } else if (key === 'effects') {
      out[key] = (value as SideEffect[]).map(canonicalizeEffect);
    } else if (key === 'evidence') {
      out[key] = (value as Evidence[]).map(canonicalizeEvidence);
    } else if (key === 'extensions' && value && typeof value === 'object') {
      out[key] = sortRecord(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function serializeRemnant(remnant: Remnant): string {
  return `${JSON.stringify(canonicalizeRemnant(remnant), null, 2)}\n`;
}

/** Compact canonical UTF-8 bytes. Used for signatures so pretty-print is not part of the signed payload. */
export function canonicalBytes(remnant: Remnant): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalizeRemnant(remnant)));
}

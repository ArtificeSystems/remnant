import { z } from 'zod';
import type { Remnant } from './remnant.js';
import {
  DIAGNOSTIC,
  diagnostic,
  type RemnantDiagnostic,
  type ValidationResult,
} from './diagnostics.js';

const SHA256 = /^[0-9a-f]{64}$/i;

export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

export function isIsoTimestamp(value: string): boolean {
  if (typeof value !== 'string' || value.length < 10) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

const outputBase = {
  name: z.string().optional(),
  description: z.string().optional(),
};

const textOutput = z.object({
  ...outputBase,
  kind: z.literal('text'),
  mediaType: z.string().optional(),
  text: z.string(),
});

const dataOutput = z.object({
  ...outputBase,
  kind: z.literal('data'),
  mediaType: z.string().optional(),
  data: z.unknown(),
});

const fileOutput = z.object({
  ...outputBase,
  kind: z.literal('file'),
  path: z.string().min(1),
  mediaType: z.string().min(1),
  sha256: z.string().optional(),
  size: z.number().nonnegative().optional(),
});

const referenceOutput = z.object({
  ...outputBase,
  kind: z.literal('reference'),
  uri: z.string().min(1),
  mediaType: z.string().optional(),
  sha256: z.string().optional(),
});

const remnantOutput = z.discriminatedUnion('kind', [
  textOutput,
  dataOutput,
  fileOutput,
  referenceOutput,
]);

const assumption = z.object({
  statement: z.string().min(1),
  basis: z.enum(['user', 'tool', 'remnant', 'external', 'agent', 'unknown']),
  ref: z.string().optional(),
});

const verification = z.object({
  claim: z.string(),
  method: z.string(),
  result: z.enum(['pass', 'fail', 'unknown']),
  evidence: z.array(z.string()).optional(),
  asOf: z.string().optional(),
  doesNotProve: z.array(z.string()).optional(),
});

const sideEffect = z.object({
  action: z.string().min(1),
  status: z.enum(['planned', 'attempted', 'completed', 'failed']),
  evidence: z.array(z.string()).optional(),
  asOf: z.string().optional(),
});

export const remnantShape = z.object({
  protocolVersion: z.literal('0.1'),
  id: z.string().min(1),
  createdAt: z.string(),
  asOf: z.string(),
  producer: z.string().min(1),
  goal: z.string(),
  status: z.enum(['draft', 'partial', 'current', 'superseded', 'rejected']),
  outputs: z.array(remnantOutput),
  assumptions: z.array(assumption),
  unknowns: z.array(z.string()),
  verification: z.array(verification),
  stop: z.array(z.string()),
  supersedes: z.array(z.string()).optional(),
  effects: z.array(sideEffect).optional(),
  nextAction: z.string().nullable().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export function semanticDiagnostics(value: Remnant): RemnantDiagnostic[] {
  const out: RemnantDiagnostic[] = [];

  if (value.protocolVersion !== '0.1') {
    out.push(
      diagnostic(
        DIAGNOSTIC.INVALID_VERSION,
        'error',
        `Unsupported protocolVersion: ${String(value.protocolVersion)}`,
        'protocolVersion',
      ),
    );
  }

  if (!isIsoTimestamp(value.createdAt)) {
    out.push(
      diagnostic(DIAGNOSTIC.INVALID_TIMESTAMP, 'error', 'createdAt is not a valid ISO timestamp', 'createdAt'),
    );
  }
  if (!isIsoTimestamp(value.asOf)) {
    out.push(diagnostic(DIAGNOSTIC.INVALID_TIMESTAMP, 'error', 'asOf is not a valid ISO timestamp', 'asOf'));
  }

  if (!value.goal.trim()) {
    out.push(diagnostic(DIAGNOSTIC.EMPTY_GOAL, 'error', 'goal must be a non-empty statement', 'goal'));
  }

  if (value.outputs.length === 0) {
    out.push(diagnostic(DIAGNOSTIC.NO_OUTPUTS, 'error', 'Remnant must include at least one output', 'outputs'));
  }

  value.outputs.forEach((output, i) => {
    if (output.kind === 'file') {
      if (!isAbsolutePath(output.path)) {
        out.push(
          diagnostic(
            DIAGNOSTIC.RELATIVE_FILE_PATH,
            'error',
            'FileOutput.path must be absolute',
            `outputs[${i}].path`,
          ),
        );
      }
      if (output.sha256 !== undefined && !SHA256.test(output.sha256)) {
        out.push(
          diagnostic(
            DIAGNOSTIC.INVALID_SHA256,
            'error',
            'sha256 must be a 64-character hex digest',
            `outputs[${i}].sha256`,
          ),
        );
      }
    }
    if (output.kind === 'reference' && output.sha256 !== undefined && !SHA256.test(output.sha256)) {
      out.push(
        diagnostic(
          DIAGNOSTIC.INVALID_SHA256,
          'error',
          'sha256 must be a 64-character hex digest',
          `outputs[${i}].sha256`,
        ),
      );
    }
  });

  value.verification.forEach((record, i) => {
    if (!record.method.trim()) {
      out.push(
        diagnostic(
          DIAGNOSTIC.VERIFICATION_NO_METHOD,
          'error',
          'Verification records require a method',
          `verification[${i}].method`,
        ),
      );
    }
    if (record.result === 'pass' && !record.claim.trim()) {
      out.push(
        diagnostic(
          DIAGNOSTIC.VERIFICATION_PASS_WITHOUT_CLAIM,
          'error',
          'result:pass requires a non-empty claim',
          `verification[${i}].claim`,
        ),
      );
    }
  });

  if (value.supersedes?.includes(value.id)) {
    out.push(
      diagnostic(DIAGNOSTIC.SELF_SUPERSESSION, 'error', 'A Remnant cannot supersede itself', 'supersedes'),
    );
  }

  if (value.supersedes) {
    const seen = new Set<string>();
    for (const id of value.supersedes) {
      if (seen.has(id)) {
        out.push(
          diagnostic(
            DIAGNOSTIC.DUPLICATE_SUPERSESSION,
            'warning',
            `Duplicate supersedes id: ${id}`,
            'supersedes',
          ),
        );
        break;
      }
      seen.add(id);
    }
  }

  if (value.status === 'current' && value.verification.some((v) => v.result === 'fail')) {
    out.push(
      diagnostic(
        DIAGNOSTIC.CURRENT_WITH_FAILED_VERIFICATION,
        'warning',
        'status is current but verification includes a failed record',
        'verification',
      ),
    );
  }

  value.effects?.forEach((effect, i) => {
    if (effect.status === 'completed' && (!effect.evidence || effect.evidence.length === 0)) {
      out.push(
        diagnostic(
          DIAGNOSTIC.EFFECT_COMPLETED_WITHOUT_EVIDENCE,
          'warning',
          'completed side effects should include evidence',
          `effects[${i}].evidence`,
        ),
      );
    }
    if (effect.asOf !== undefined && !isIsoTimestamp(effect.asOf)) {
      out.push(
        diagnostic(
          DIAGNOSTIC.INVALID_TIMESTAMP,
          'error',
          'effect asOf is not a valid ISO timestamp',
          `effects[${i}].asOf`,
        ),
      );
    }
  });

  value.verification.forEach((record, i) => {
    if (record.asOf !== undefined && !isIsoTimestamp(record.asOf)) {
      out.push(
        diagnostic(
          DIAGNOSTIC.INVALID_TIMESTAMP,
          'error',
          'verification asOf is not a valid ISO timestamp',
          `verification[${i}].asOf`,
        ),
      );
    }
  });

  return out;
}

export function validateRemnant(value: unknown): ValidationResult {
  const parsed = remnantShape.safeParse(value);
  if (!parsed.success) {
    const errors: RemnantDiagnostic[] = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.') || undefined;
      const message = issue.message;
      if (path === 'protocolVersion' || issue.path[0] === 'protocolVersion') {
        return diagnostic(DIAGNOSTIC.INVALID_VERSION, 'error', message, path);
      }
      if (path === 'goal' || issue.path[0] === 'goal') {
        return diagnostic(DIAGNOSTIC.EMPTY_GOAL, 'error', message, path);
      }
      return diagnostic('REMNANT_SCHEMA', 'error', message, path);
    });
    return { ok: false, errors, warnings: [] };
  }

  const diagnostics = semanticDiagnostics(parsed.data as Remnant);
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}

import type { Remnant } from './remnant.js';
import { semanticDiagnostics } from './schema.js';
import type { RemnantDiagnostic } from './diagnostics.js';

export interface AuditOptions {
  inspectFiles?: boolean;
  verifyHashes?: boolean;
  now?: Date;
}

export interface RemnantAudit {
  diagnostics: RemnantDiagnostic[];
  outputInspections?: Record<string, unknown>;
}

/**
 * Semantic audit only. File inspection lives in `@artificesystems/remnant/node`.
 * `inspectFiles` / `verifyHashes` are ignored here so Core stays isomorphic.
 */
export function auditRemnant(remnant: Remnant, _options: AuditOptions = {}): RemnantAudit {
  return { diagnostics: semanticDiagnostics(remnant) };
}

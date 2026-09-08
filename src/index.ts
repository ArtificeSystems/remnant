export type {
  Assumption,
  AssumptionBasis,
  CreateRemnantInput,
  CreateRemnantOptions,
  DataOutput,
  FileOutput,
  OutputBase,
  ReferenceOutput,
  Remnant,
  RemnantOutput,
  RemnantOutputInput,
  RemnantStatus,
  SideEffect,
  SideEffectStatus,
  TextOutput,
  VerificationRecord,
  VerificationResult,
} from './remnant.js';
export { PROTOCOL_VERSION } from './remnant.js';

export {
  createRemnant,
  generateRemnantId,
  normalizeAssumption,
  RemnantValidationError,
  ulid,
} from './create.js';
export { parseRemnant } from './parse.js';
export { serializeRemnant, canonicalizeRemnant } from './serialize.js';
export { validateRemnant, isAbsolutePath, isIsoTimestamp } from './schema.js';
export {
  addOutput,
  addStop,
  addUnknown,
  addVerification,
  recordEffect,
  supersede,
} from './helpers.js';
export { renderRemnantForAgent, type RenderRemnantOptions, type OutputRenderMode } from './render.js';
export { auditRemnant, type AuditOptions, type RemnantAudit } from './audit.js';
export { redactRemnant } from './redact.js';
export {
  DIAGNOSTIC,
  diagnostic,
  type DiagnosticSeverity,
  type RemnantDiagnostic,
  type ValidationResult,
} from './diagnostics.js';

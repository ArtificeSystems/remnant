export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface RemnantDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
}

export const DIAGNOSTIC = {
  INVALID_VERSION: 'REMNANT_INVALID_VERSION',
  INVALID_TIMESTAMP: 'REMNANT_INVALID_TIMESTAMP',
  EMPTY_GOAL: 'REMNANT_EMPTY_GOAL',
  NO_OUTPUTS: 'REMNANT_NO_OUTPUTS',
  RELATIVE_FILE_PATH: 'REMNANT_RELATIVE_FILE_PATH',
  INVALID_SHA256: 'REMNANT_INVALID_SHA256',
  VERIFICATION_NO_METHOD: 'REMNANT_VERIFICATION_NO_METHOD',
  VERIFICATION_PASS_WITHOUT_CLAIM: 'REMNANT_VERIFICATION_PASS_WITHOUT_CLAIM',
  EFFECT_COMPLETED_WITHOUT_EVIDENCE: 'REMNANT_EFFECT_COMPLETED_WITHOUT_EVIDENCE',
  SELF_SUPERSESSION: 'REMNANT_SELF_SUPERSESSION',
  DUPLICATE_SUPERSESSION: 'REMNANT_DUPLICATE_SUPERSESSION',
  CURRENT_WITH_FAILED_VERIFICATION: 'REMNANT_CURRENT_WITH_FAILED_VERIFICATION',
  FILE_MISSING: 'REMNANT_FILE_MISSING',
  FILE_HASH_MISMATCH: 'REMNANT_FILE_HASH_MISMATCH',
  FILE_SIZE_MISMATCH: 'REMNANT_FILE_SIZE_MISMATCH',
  FILE_MEDIA_TYPE_MISMATCH: 'REMNANT_FILE_MEDIA_TYPE_MISMATCH',
  FILE_NOT_FILE: 'REMNANT_FILE_NOT_FILE',
  FILE_PERMISSION: 'REMNANT_FILE_PERMISSION',
} as const;

export interface ValidationResult {
  ok: boolean;
  errors: RemnantDiagnostic[];
  warnings: RemnantDiagnostic[];
}

export function diagnostic(
  code: string,
  severity: DiagnosticSeverity,
  message: string,
  path?: string,
): RemnantDiagnostic {
  return path === undefined ? { code, severity, message } : { code, severity, message, path };
}

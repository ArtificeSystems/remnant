import type { FileOutput, Remnant } from '../remnant.js';
import { auditRemnant as semanticAudit, type AuditOptions, type RemnantAudit } from '../audit.js';
import { DIAGNOSTIC, diagnostic } from '../diagnostics.js';
import { inspectFileOutput } from './inspect-file.js';

export type { AuditOptions, RemnantAudit } from '../audit.js';

export async function auditRemnant(
  remnant: Remnant,
  options: AuditOptions = {},
): Promise<RemnantAudit> {
  const audit = semanticAudit(remnant, options);
  if (!options.inspectFiles && !options.verifyHashes) {
    return audit;
  }

  const inspections: Record<string, unknown> = {};
  for (let i = 0; i < remnant.outputs.length; i++) {
    const output = remnant.outputs[i];
    if (!output || output.kind !== 'file') continue;
    const file = output as FileOutput;
    const inspection = await inspectFileOutput(file, {
      hash: options.verifyHashes ?? true,
      sniffMediaType: true,
    });
    const key = file.name ?? file.path;
    inspections[key] = inspection;

    const path = `outputs[${i}]`;
    if (inspection.error === 'EACCES') {
      audit.diagnostics.push(
        diagnostic(DIAGNOSTIC.FILE_PERMISSION, 'error', `Permission denied: ${file.path}`, path),
      );
      continue;
    }
    if (!inspection.exists) {
      audit.diagnostics.push(diagnostic(DIAGNOSTIC.FILE_MISSING, 'error', `Output file does not exist: ${file.path}`, path));
      continue;
    }
    if (!inspection.isFile) {
      audit.diagnostics.push(diagnostic(DIAGNOSTIC.FILE_NOT_FILE, 'error', `Output path is not a file: ${file.path}`, path));
      continue;
    }
    if (file.size !== undefined && inspection.actualSize !== undefined && file.size !== inspection.actualSize) {
      audit.diagnostics.push(
        diagnostic(
          DIAGNOSTIC.FILE_SIZE_MISMATCH,
          'error',
          `Declared size ${file.size} != actual ${inspection.actualSize}`,
          `${path}.size`,
        ),
      );
    }
    if (inspection.hashMatches === false) {
      audit.diagnostics.push(
        diagnostic(DIAGNOSTIC.FILE_HASH_MISMATCH, 'error', 'Declared sha256 does not match file bytes', `${path}.sha256`),
      );
    }
    if (inspection.mediaTypeMatches === false) {
      audit.diagnostics.push(
        diagnostic(
          DIAGNOSTIC.FILE_MEDIA_TYPE_MISMATCH,
          'warning',
          `Declared ${file.mediaType} vs detected ${inspection.detectedMediaType ?? 'unknown'}`,
          `${path}.mediaType`,
        ),
      );
    }
  }

  return { diagnostics: audit.diagnostics, outputInspections: inspections };
}

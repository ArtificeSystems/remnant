import type { Evidence, Remnant, SideEffect, VerificationRecord } from './remnant.js';
import type { CurrentStore } from './store.js';

const PROOF_TYPES = new Set(['proof', 'claim-proof', 'eng-proof']);

function hasEvidencePayload(item: Evidence): boolean {
  return Boolean(item.uri?.trim() || item.digest?.trim() || item.data !== undefined);
}

export function isProofEvidence(item: Evidence): boolean {
  const type = item.type.toLowerCase();
  return PROOF_TYPES.has(type) || type.endsWith('/proof');
}

export function isProofVerification(record: VerificationRecord): boolean {
  const claim = record.claim.toLowerCase();
  const method = record.method.toLowerCase();
  return method === 'proof' || claim.startsWith('proof:');
}

export function effectUsedAsProof(effect: SideEffect): boolean {
  return /\bproof\b/i.test(effect.action);
}

function verificationHasEvidence(record: VerificationRecord): boolean {
  return (record.evidence?.length ?? 0) > 0;
}

/**
 * Fail-closed: proof-marked claims and proof-like completed effects require evidence.
 */
export function proofDiagnostics(remnant: Remnant): string[] {
  const issues: string[] = [];

  for (const item of remnant.evidence ?? []) {
    if (isProofEvidence(item) && !hasEvidencePayload(item)) {
      issues.push(`proof evidence missing payload: ${item.type}`);
    }
  }

  for (const record of remnant.verification) {
    if (isProofVerification(record) && !verificationHasEvidence(record)) {
      issues.push(`proof verification missing evidence: ${record.claim}`);
    }
  }

  for (const effect of remnant.effects ?? []) {
    if (effect.status === 'completed' && effectUsedAsProof(effect) && (effect.evidence?.length ?? 0) === 0) {
      issues.push(`completed effect used as proof without evidence: ${effect.action}`);
    }
  }

  if (remnant.extensions?.proof === true && (remnant.evidence?.length ?? 0) === 0) {
    issues.push('remnant marked proof without evidence');
  }

  return issues;
}

export function isProofEligible(remnant: Remnant): boolean {
  return proofDiagnostics(remnant).length === 0;
}

/**
 * Resolve a Remnant as current proof only when it is current in the store and proof-eligible.
 * A bare v0.1 parse may succeed without becoming current proof.
 */
export function resolveCurrentProof(store: CurrentStore, id: string): Remnant | undefined {
  const current = store.resolveCurrent(id);
  if (!current) return undefined;
  if (!isProofEligible(current)) return undefined;
  return current;
}

import type { SignedRemnant } from './crypto/index.js';
import { verifyRemnantSignature } from './crypto/index.js';
import type { Remnant } from './remnant.js';
import { isProofEligible, proofDiagnostics } from './proof.js';
import type { CurrentStore } from './store.js';
import { isIsoTimestamp, validateRemnant } from './schema.js';

export interface SafeToActOptions {
  store?: CurrentStore;
  publicKey?: string;
  now?: Date;
  /** Caller-supplied max age in ms for `asOf`. No default; omit to skip age check. */
  maxAge?: number;
}

export interface SafeToActResult {
  safe: boolean;
  stop: string[];
}

const MUTATE_RE =
  /\b(commit|push|deploy|merge|ship|mutate|fix|apply|trade|close|publish|send|mark\b.*\bcomplete)\b/i;
const CONFIDENCE_RE = /\b(highly confident|high confidence|fully fixed|production-ready)\b/i;

function push(stop: string[], reason: string): void {
  if (!stop.includes(reason)) stop.push(reason);
}

function hasCompletedEffect(remnant: Remnant): boolean {
  return (remnant.effects ?? []).some((e) => e.status === 'completed');
}

function blocksRepeat(remnant: Remnant): boolean {
  return remnant.stop.some((s) => /do not (send|repeat|resend)/i.test(s));
}

function nextActionSuggestsContinue(remnant: Remnant): boolean {
  const next = remnant.nextAction ?? '';
  return /\bcontinue\b/i.test(next);
}

function nextActionWidensGoal(remnant: Remnant): boolean {
  const goal = remnant.goal.toLowerCase();
  const next = (remnant.nextAction ?? '').toLowerCase();
  if (!next) return false;
  if (/\bwithout changing\b/.test(goal) && MUTATE_RE.test(next)) return true;
  if (/\bwithout\b.*\bcode\b/.test(goal) && MUTATE_RE.test(next)) return true;
  if (/\bsummarize\b/.test(goal) && MUTATE_RE.test(next)) return true;
  return false;
}

function agentAuthoritySmuggling(remnant: Remnant): boolean {
  const risky = remnant.assumptions.some(
    (a) =>
      a.basis === 'agent' &&
      /\b(approved|approval|authority|may act|production|deploy)\b/i.test(a.statement),
  );
  const next = remnant.nextAction ?? '';
  return risky && MUTATE_RE.test(next);
}

function verificationPassWithoutEvidence(remnant: Remnant): boolean {
  return remnant.verification.some((v) => v.result === 'pass' && (v.evidence?.length ?? 0) === 0);
}

function epistemicSludge(remnant: Remnant): boolean {
  if (remnant.unknowns.length === 0) return false;
  const next = remnant.nextAction ?? '';
  return /\b(publish|report|state|quote)\b/i.test(next);
}

function toolCapabilityBluff(remnant: Remnant): boolean {
  const connectorAssumption = remnant.assumptions.some((a) =>
    /\b(connector|receiver has|tool)\b/i.test(a.statement),
  );
  const connectorVerification = remnant.verification.some((v) => /\b[a-z]+\.[a-z]+/i.test(v.method));
  return connectorAssumption && connectorVerification;
}

function quotedTotalWithoutInspection(remnant: Remnant): boolean {
  const hasFile = remnant.outputs.some((o) => o.kind === 'file');
  const quotedNumber = remnant.outputs.some(
    (o) => o.kind === 'text' && /\$?\d[\d,]*(?:\.\d+)?/.test(o.text),
  );
  const inspected = remnant.verification.some((v) =>
    /\b(inspect|read|open|rehash|hash)\b/i.test(v.method),
  );
  return hasFile && quotedNumber && !inspected;
}

function safetyStatusInversion(remnant: Remnant): boolean {
  if (remnant.unknowns.length === 0 || remnant.stop.length === 0) return false;
  const next = remnant.nextAction ?? '';
  return MUTATE_RE.test(next);
}

function authoritySwap(remnant: Remnant): boolean {
  return remnant.assumptions.some((a) =>
    /\b(receiver may act|act as|other person|other user|acct_)\b/i.test(a.statement),
  );
}

function citationLaundering(remnant: Remnant): boolean {
  return remnant.verification.some(
    (v) => v.result === 'pass' && (v.doesNotProve?.length ?? 0) > 0 && (v.evidence?.length ?? 0) > 0,
  );
}

function confidenceWithoutMethod(remnant: Remnant): boolean {
  if (remnant.verification.length > 0) return false;
  const text = remnant.outputs
    .filter((o) => o.kind === 'text')
    .map((o) => o.text)
    .join(' ');
  const next = remnant.nextAction ?? '';
  return CONFIDENCE_RE.test(text) && /\b(ship|production)\b/i.test(next);
}

function completenessLie(remnant: Remnant): boolean {
  const fileOutputs = remnant.outputs.filter((o) => o.kind === 'file');
  if (fileOutputs.length === 0) return false;
  const inspected = remnant.verification.some((v) =>
    /\b(inspect|exists|present|open|read)\b/i.test(`${v.method} ${v.claim}`),
  );
  const next = remnant.nextAction ?? '';
  const wantsComplete = /\b(complete|ship|send|attach|mark)\b/i.test(next);
  return wantsComplete && !inspected && fileOutputs.some((o) => o.kind === 'file' && !o.sha256);
}

function asOfPresent(remnant: Remnant): boolean {
  return Boolean(remnant.asOf?.trim()) && isIsoTimestamp(remnant.asOf);
}

function exceedsMaxAge(remnant: Remnant, now: Date, maxAge: number): boolean {
  const asOf = Date.parse(remnant.asOf);
  if (!Number.isFinite(asOf)) return false;
  return now.getTime() - asOf > maxAge;
}

function supersessionValid(remnant: Remnant, store?: CurrentStore): boolean {
  const ids = remnant.supersedes ?? [];
  if (ids.length === 0) return true;
  if (!store) return true;
  for (const prevId of ids) {
    if (store.resolveCurrent(prevId) !== undefined) {
      return false;
    }
  }
  return store.resolveCurrent(remnant.id) !== undefined;
}

function requiredEvidencePresent(remnant: Remnant): boolean {
  for (const effect of remnant.effects ?? []) {
    if (effect.status === 'completed' && (effect.evidence?.length ?? 0) === 0) {
      return false;
    }
  }
  for (const record of remnant.verification) {
    if (record.result === 'pass' && (record.evidence?.length ?? 0) === 0) {
      return false;
    }
  }
  return true;
}

function adversarialStops(remnant: Remnant): string[] {
  const stop: string[] = [];

  if (hasCompletedEffect(remnant) && blocksRepeat(remnant) && nextActionSuggestsContinue(remnant)) {
    push(stop, 'completed side effect must not be repeated');
  }
  if (agentAuthoritySmuggling(remnant)) {
    push(stop, 'agent inference is not user authority');
  }
  if (nextActionWidensGoal(remnant)) {
    push(stop, 'nextAction exceeds goal');
  }
  if (verificationPassWithoutEvidence(remnant)) {
    push(stop, 'verification pass requires evidence');
  }
  if (epistemicSludge(remnant)) {
    push(stop, 'unknowns block publishing inferred facts');
  }
  if (toolCapabilityBluff(remnant)) {
    push(stop, 'tool capability cannot be inherited from producer');
  }
  if (quotedTotalWithoutInspection(remnant)) {
    push(stop, 'quoted totals require file inspection');
  }
  if (safetyStatusInversion(remnant)) {
    push(stop, 'unknowns and stop rules block the proposed action');
  }
  if (authoritySwap(remnant)) {
    push(stop, 'receiver authority must not be inherited');
  }
  if (citationLaundering(remnant)) {
    push(stop, 'verification scope does not support the claim');
  }
  if (confidenceWithoutMethod(remnant)) {
    push(stop, 'confidence prose is not verification');
  }
  if (completenessLie(remnant)) {
    push(stop, 'file outputs require inspection before completion');
  }

  for (const issue of proofDiagnostics(remnant)) {
    push(stop, issue);
  }

  return stop;
}

/**
 * Machine STOP gate. Returns false unless status is current, signature verifies,
 * as_of is present, supersession is valid, required evidence is present, and adversarial traps are absent.
 * Optional maxAge is caller-supplied; there is no default stale window.
 */
export function isSafeToAct(signed: SignedRemnant, options: SafeToActOptions = {}): SafeToActResult {
  const stop: string[] = [];
  const remnant = signed.remnant;
  const now = options.now ?? new Date();

  if (!asOfPresent(remnant)) {
    push(stop, 'as_of is missing');
  }

  const shape = validateRemnant(remnant);
  if (!shape.ok) {
    for (const err of shape.errors) push(stop, err.message);
    return { safe: false, stop };
  }

  if (remnant.status !== 'current') {
    push(stop, 'status must be current');
  }

  if (!verifyRemnantSignature(signed, options.publicKey)) {
    push(stop, 'signature verification failed');
  }

  if (!supersessionValid(remnant, options.store)) {
    push(stop, 'supersedes is invalid or superseded artifact remains current');
  }

  if (!requiredEvidencePresent(remnant)) {
    push(stop, 'required evidence is missing');
  }

  if (!isProofEligible(remnant)) {
    for (const issue of proofDiagnostics(remnant)) push(stop, issue);
  }

  if (options.maxAge !== undefined && exceedsMaxAge(remnant, now, options.maxAge)) {
    push(stop, 'asOf exceeds maxAge');
  }

  for (const reason of adversarialStops(remnant)) {
    push(stop, reason);
  }

  return { safe: stop.length === 0, stop };
}

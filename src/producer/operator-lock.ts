import { createRemnant } from '../create.js';
import type { Evidence, Remnant, RemnantStatus } from '../remnant.js';
import { isIsoTimestamp } from '../schema.js';
import { serializeRemnant } from '../serialize.js';

/** Orders may be considered only while this lock is pinned. Not a live order. */
export const OPERATOR_LOCK_ORDERS = 'allowed-when-pinned' as const;

export const OPERATOR_LOCK_PAPER_STOP = 'Paper only; do not send live orders';

const OPERATOR_LOCK_EXTENSION = 'com.remnant.demo.operator-lock';

export interface OperatorLockCard {
  /** Always null. This card never names a live account. */
  accountId: null;
  /** Policy name: orders only when the lock is pinned. Not a trade instruction. */
  orders: typeof OPERATOR_LOCK_ORDERS;
  /** Paper only. Always true. */
  paper: true;
  status: RemnantStatus;
  supersedes?: string[];
  /** Authority has authorized this artifact. Distinct from lifecycle `status: current`. */
  locked: boolean;
  authority: string;
  claim: string;
  evidence: Evidence[];
  not_checked: string[];
  lane: string;
  stop: string[];
  /** Freshness boundary for represented state (maps to Remnant `asOf`). */
  as_of: string;
}

export interface WriteOperatorLockInput {
  status: RemnantStatus;
  supersedes?: string[];
  locked?: boolean;
  authority: string;
  claim?: string;
  evidence?: Evidence[];
  not_checked?: string[];
  lane: string;
  stop?: string[];
  as_of: string;
  producer: string;
  goal?: string;
}

function requireAsOf(asOf: string): string {
  const value = asOf?.trim() ?? '';
  if (!value || !isIsoTimestamp(value)) {
    throw new Error('operator-lock as_of is required and must be an ISO timestamp');
  }
  return value;
}

function withPaperStop(stop: string[]): string[] {
  if (stop.some((item) => /paper only/i.test(item) && /live order/i.test(item))) {
    return [...stop];
  }
  return [OPERATOR_LOCK_PAPER_STOP, ...stop];
}

/**
 * Write one paper operator-lock card.
 * `accountId` is always null, `orders` is always `allowed-when-pinned`, and `paper` is always true.
 * Demo producer only; the host must verify before acting.
 */
export function writeOperatorLockCard(input: WriteOperatorLockInput): OperatorLockCard {
  const asOf = requireAsOf(input.as_of);
  const claim = input.claim?.trim() || 'Paper operator lock; orders allowed only when pinned';
  const card: OperatorLockCard = {
    accountId: null,
    orders: OPERATOR_LOCK_ORDERS,
    paper: true,
    status: input.status,
    locked: input.locked ?? Boolean(input.authority.trim()),
    authority: input.authority,
    claim,
    evidence: (input.evidence ?? []).map((item) => ({ ...item })),
    not_checked: [...(input.not_checked ?? ['live account binding', 'live order path'])],
    lane: input.lane,
    stop: withPaperStop([...(input.stop ?? [])]),
    as_of: asOf,
  };
  if (input.supersedes && input.supersedes.length > 0) {
    card.supersedes = [...input.supersedes];
  }
  return card;
}

/** Map an operator-lock card to a Remnant envelope. Demo payload only. */
export function operatorLockToRemnant(card: OperatorLockCard, input: WriteOperatorLockInput): Remnant {
  if (card.accountId !== null || card.paper !== true || card.orders !== OPERATOR_LOCK_ORDERS) {
    throw new Error('operator-lock card must stay paper-only with a null accountId');
  }

  const verification =
    card.evidence.length > 0
      ? [
          {
            claim: card.claim,
            method: 'operator-lock',
            result: 'pass' as const,
            evidence: card.evidence.map((item) => item.uri ?? item.digest ?? item.type),
          },
        ]
      : [];

  return createRemnant({
    producer: input.producer,
    goal: input.goal ?? card.claim,
    status: card.status,
    asOf: card.as_of,
    outputs: [{ kind: 'text', text: card.claim }],
    unknowns: [...card.not_checked],
    notChecked: [...card.not_checked],
    authority: card.authority,
    lane: card.lane,
    locked: card.locked,
    verification,
    stop: card.stop,
    supersedes: card.supersedes,
    evidence: card.evidence,
    extensions: {
      [OPERATOR_LOCK_EXTENSION]: {
        accountId: card.accountId,
        orders: card.orders,
        paper: card.paper,
      },
    },
  });
}

export function serializeOperatorLockCard(card: OperatorLockCard): string {
  return `${JSON.stringify(card, null, 2)}\n`;
}

export function produceOperatorLock(input: WriteOperatorLockInput): { card: OperatorLockCard; remnant: Remnant } {
  const card = writeOperatorLockCard(input);
  const remnant = operatorLockToRemnant(card, input);
  return { card, remnant };
}

export function writeOperatorLockFile(input: WriteOperatorLockInput): string {
  const { card } = produceOperatorLock(input);
  return serializeOperatorLockCard(card);
}

export { serializeRemnant };
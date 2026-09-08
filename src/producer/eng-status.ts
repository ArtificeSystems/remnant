import { createRemnant } from '../create.js';
import type { Evidence, Remnant, RemnantStatus } from '../remnant.js';
import { serializeRemnant } from '../serialize.js';

export interface EngStatusCard {
  status: RemnantStatus;
  supersedes?: string[];
  authority: string;
  claim: string;
  evidence: Evidence[];
  not_checked: string[];
  lane: string;
  stop: string[];
}

export interface WriteEngStatusInput {
  status: RemnantStatus;
  supersedes?: string[];
  authority: string;
  claim: string;
  evidence?: Evidence[];
  not_checked?: string[];
  lane: string;
  stop?: string[];
  producer: string;
  goal?: string;
}

/**
 * Write one eng-status card. This is the demo producer — it does not call other products.
 */
export function writeEngStatusCard(input: WriteEngStatusInput): EngStatusCard {
  const card: EngStatusCard = {
    status: input.status,
    authority: input.authority,
    claim: input.claim,
    evidence: (input.evidence ?? []).map((e) => ({ ...e })),
    not_checked: [...(input.not_checked ?? [])],
    lane: input.lane,
    stop: [...(input.stop ?? [])],
  };
  if (input.supersedes && input.supersedes.length > 0) {
    card.supersedes = [...input.supersedes];
  }
  return card;
}

/** Map an eng-status card to a Remnant envelope for storage and signing. */
export function engStatusToRemnant(card: EngStatusCard, input: WriteEngStatusInput): Remnant {
  const unknowns = [...card.not_checked];
  const verification =
    card.evidence.length > 0
      ? [
          {
            claim: card.claim,
            method: 'eng-status',
            result: 'pass' as const,
            evidence: card.evidence.map((e) => e.uri ?? e.digest ?? e.type),
          },
        ]
      : [];

  const remnant = createRemnant({
    producer: input.producer,
    goal: input.goal ?? card.claim,
    status: card.status,
    outputs: [{ kind: 'text', text: card.claim }],
    assumptions: [{ statement: `Authority: ${card.authority}`, basis: 'external', ref: card.authority }],
    unknowns,
    verification,
    stop: card.stop,
    supersedes: card.supersedes,
    evidence: card.evidence,
    extensions: {
      'com.artifice.eng-status': {
        lane: card.lane,
        authority: card.authority,
        not_checked: card.not_checked,
      },
    },
  });

  return remnant;
}

/** Serialize an eng-status card as JSON for local files or handoff. */
export function serializeEngStatusCard(card: EngStatusCard): string {
  return `${JSON.stringify(card, null, 2)}\n`;
}

/** Convenience: write card and return both card and Remnant envelope. */
export function produceEngStatus(input: WriteEngStatusInput): { card: EngStatusCard; remnant: Remnant } {
  const card = writeEngStatusCard(input);
  const remnant = engStatusToRemnant(card, input);
  return { card, remnant };
}

export function writeEngStatusFile(input: WriteEngStatusInput): string {
  const { card } = produceEngStatus(input);
  return serializeEngStatusCard(card);
}

export { serializeRemnant };

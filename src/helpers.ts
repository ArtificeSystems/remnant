import { createRemnant } from './create.js';
import type {
  CreateRemnantInput,
  Remnant,
  RemnantOutput,
  SideEffect,
  VerificationRecord,
} from './remnant.js';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function addVerification(remnant: Remnant, record: VerificationRecord): Remnant {
  return { ...clone(remnant), verification: [...remnant.verification, { ...record }] };
}

export function addOutput(remnant: Remnant, output: RemnantOutput): Remnant {
  return { ...clone(remnant), outputs: [...remnant.outputs, { ...output }] };
}

export function addUnknown(remnant: Remnant, unknown: string): Remnant {
  return { ...clone(remnant), unknowns: [...remnant.unknowns, unknown] };
}

export function addStop(remnant: Remnant, stop: string): Remnant {
  return { ...clone(remnant), stop: [...remnant.stop, stop] };
}

export function recordEffect(remnant: Remnant, effect: SideEffect): Remnant {
  return { ...clone(remnant), effects: [...(remnant.effects ?? []), { ...effect }] };
}

export function supersede(previous: Remnant, nextInput: CreateRemnantInput): Remnant {
  const { id: _id, ...rest } = nextInput;
  return createRemnant({
    ...rest,
    supersedes: [...new Set([...(nextInput.supersedes ?? []), previous.id])],
  });
}

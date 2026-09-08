import type { Remnant } from './remnant.js';

export type ConflictReason = 'conflicting_current_without_supersession' | 'duplicate_id';

export interface RemnantConflict {
  remnants: string[];
  reason: ConflictReason;
  goal?: string;
}

export interface RemnantResolution {
  current: Remnant[];
  superseded: Remnant[];
  rejected: Remnant[];
  conflicts: RemnantConflict[];
}

/**
 * Classify a set of Remnants by supersession and rejection.
 * Does not mutate inputs. Does not walk a dependency graph beyond explicit `supersedes`.
 * "Same goal" is exact string identity (`===`). No trim, case-fold, or semantic matching.
 */
export function resolveCurrent(remnants: Remnant[]): RemnantResolution {
  const byId = new Map<string, Remnant[]>();
  for (const remnant of remnants) {
    const list = byId.get(remnant.id) ?? [];
    list.push(remnant);
    byId.set(remnant.id, list);
  }

  const supersededIds = new Set<string>();
  for (const remnant of remnants) {
    for (const id of remnant.supersedes ?? []) supersededIds.add(id);
  }

  const conflicts: RemnantConflict[] = [];
  for (const [id, copies] of byId) {
    if (copies.length > 1) {
      conflicts.push({ remnants: [id], reason: 'duplicate_id' });
    }
  }

  const seen = new Set<Remnant>();
  const rejected: Remnant[] = [];
  const superseded: Remnant[] = [];
  const remaining: Remnant[] = [];

  for (const remnant of remnants) {
    if (seen.has(remnant)) continue;
    seen.add(remnant);
    if (remnant.status === 'rejected') {
      rejected.push(remnant);
      continue;
    }
    if (remnant.status === 'superseded' || supersededIds.has(remnant.id)) {
      superseded.push(remnant);
      continue;
    }
    remaining.push(remnant);
  }

  const current: Remnant[] = [];
  const currentByGoal = new Map<string, Remnant[]>();
  for (const remnant of remaining) {
    if (remnant.status !== 'current') {
      if (remnant.status === 'partial') current.push(remnant);
      continue;
    }
    const key = remnant.goal;
    const group = currentByGoal.get(key) ?? [];
    group.push(remnant);
    currentByGoal.set(key, group);
  }

  for (const [goal, group] of currentByGoal) {
    if (group.length === 1) {
      current.push(group[0]!);
      continue;
    }
    conflicts.push({
      remnants: group.map((r) => r.id),
      reason: 'conflicting_current_without_supersession',
      goal,
    });
  }

  return { current, superseded, rejected, conflicts };
}

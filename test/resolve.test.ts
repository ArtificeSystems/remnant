import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRemnant, resolveCurrent, type Remnant } from '../src/index.ts';

function remnant(partial: { id: string; status: Remnant['status']; goal?: string; supersedes?: string[] }): Remnant {
  return createRemnant({
    id: partial.id,
    producer: 'test',
    goal: partial.goal ?? 'Fix login',
    status: partial.status,
    outputs: [{ kind: 'text', text: partial.id }],
    supersedes: partial.supersedes,
  });
}

describe('resolveCurrent', () => {
  it('follows explicit supersession even if the older remnant still says current', () => {
    const older = remnant({ id: 'art_login_002', status: 'current' });
    const newer = remnant({ id: 'art_login_003', status: 'current', supersedes: ['art_login_002'] });
    const snapshot = structuredClone(older);
    const resolved = resolveCurrent([older, newer]);
    assert.deepEqual(resolved.current.map((r) => r.id), ['art_login_003']);
    assert.deepEqual(resolved.superseded.map((r) => r.id), ['art_login_002']);
    assert.equal(resolved.conflicts.length, 0);
    assert.deepEqual(older, snapshot);
  });

  it('reports conflict when two current remnants share a goal without supersession', () => {
    const a = remnant({ id: 'rem_1', status: 'current' });
    const b = remnant({ id: 'rem_2', status: 'current' });
    const resolved = resolveCurrent([a, b]);
    assert.deepEqual(resolved.current, []);
    assert.equal(resolved.conflicts.length, 1);
    assert.equal(resolved.conflicts[0]?.reason, 'conflicting_current_without_supersession');
    assert.deepEqual(resolved.conflicts[0]?.remnants, ['rem_1', 'rem_2']);
  });

  it('does not conflict paraphrased goals — exact string identity only', () => {
    const a = remnant({ id: 'rem_1', status: 'current', goal: 'Fix login' });
    const b = remnant({ id: 'rem_2', status: 'current', goal: 'Repair authentication' });
    const spaced = remnant({ id: 'rem_3', status: 'current', goal: 'Fix login ' });
    const resolved = resolveCurrent([a, b, spaced]);
    assert.deepEqual(resolved.current.map((r) => r.id).sort(), ['rem_1', 'rem_2', 'rem_3']);
    assert.equal(resolved.conflicts.length, 0);
  });

  it('keeps rejected out of current', () => {
    const rejected = remnant({ id: 'art_f01', status: 'rejected' });
    const resolved = resolveCurrent([rejected]);
    assert.deepEqual(resolved.rejected.map((r) => r.id), ['art_f01']);
    assert.equal(resolved.current.length, 0);
  });

  it('treats unused partial work as current without claiming completeness', () => {
    const partial = remnant({ id: 'art_m01', status: 'partial' });
    const resolved = resolveCurrent([partial]);
    assert.deepEqual(resolved.current.map((r) => r.id), ['art_m01']);
  });
});

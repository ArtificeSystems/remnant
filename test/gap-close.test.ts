import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  createRemnant,
  createCurrentStore,
  CurrentStoreError,
  FileCurrentStore,
  InMemoryCurrentStore,
  isSafeToAct,
  isProofEligible,
  produceEngStatus,
  resolveCurrentProof,
  writeEngStatusCard,
} from '../src/index.ts';
import { generateSigningKeyPair, signRemnant } from '../src/crypto/index.ts';
import { getCase } from '../src/conformance/index.ts';

function signed(remnant: ReturnType<typeof createRemnant>, keys = generateSigningKeyPair()) {
  return signRemnant(remnant, keys.privateKey);
}

function minimalCurrent(overrides: Record<string, unknown> = {}) {
  return createRemnant({
    producer: 'test.agent',
    goal: 'Safe engineering task',
    status: 'current',
    outputs: [{ kind: 'text', text: 'Done.' }],
    verification: [{ claim: 'checked', method: 'manual inspect', result: 'pass', evidence: ['note:ok'] }],
    ...overrides,
  });
}

describe('CurrentStore', () => {
  it('puts and resolves the current artifact by id', () => {
    const store = new InMemoryCurrentStore();
    const artifact = minimalCurrent();
    store.put(artifact);
    assert.deepEqual(store.resolveCurrent(artifact.id), artifact);
  });

  it('rejects a second current for the same goal without supersede', () => {
    const store = new InMemoryCurrentStore();
    store.put(minimalCurrent({ goal: 'Fix login' }));
    assert.throws(
      () => store.put(minimalCurrent({ goal: 'Fix login' })),
      (err: unknown) => err instanceof CurrentStoreError,
    );
  });

  it('supersedes an older current and stops resolving the older id', () => {
    const store = new InMemoryCurrentStore();
    const older = minimalCurrent({ goal: 'Fix login' });
    store.put(older);
    const newer = createRemnant({
      producer: 'test.agent',
      goal: 'Fix login',
      status: 'current',
      outputs: [{ kind: 'text', text: 'new' }],
      supersedes: [older.id],
      verification: [{ claim: 'checked', method: 'manual inspect', result: 'pass', evidence: ['note:ok'] }],
    });
    store.put(newer);
    assert.equal(store.resolveCurrent(older.id), undefined);
    assert.deepEqual(store.resolveCurrent(newer.id), newer);
  });

  it('persists to a local file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'remnant-store-'));
    const path = join(dir, 'current.json');
    const artifact = minimalCurrent({ goal: 'Persist me' });
    const first = new FileCurrentStore({ path });
    first.put(artifact);
    const second = new FileCurrentStore({ path });
    assert.deepEqual(second.resolveCurrent(artifact.id), artifact);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('isSafeToAct STOP', () => {
  const keys = generateSigningKeyPair();

  it('returns safe for a signed current remnant with evidence', () => {
    const result = isSafeToAct(signed(minimalCurrent(), keys), { publicKey: keys.publicKey });
    assert.equal(result.safe, true);
    assert.deepEqual(result.stop, []);
  });

  it('stops when status is not current', () => {
    const draft = createRemnant({
      producer: 'test',
      goal: 'Safe engineering task',
      status: 'draft',
      outputs: [{ kind: 'text', text: 'x' }],
    });
    const result = isSafeToAct(signed(draft, keys), { publicKey: keys.publicKey });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => s.includes('current')));
  });

  it('stops when signature verification fails', () => {
    const other = generateSigningKeyPair();
    const result = isSafeToAct(signed(minimalCurrent(), keys), { publicKey: other.publicKey });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => s.includes('signature')));
  });

  const machineStopCases = [
    'AP-A01',
    'AP-C01',
    'AP-D01',
    'AP-E01',
    'AP-G01',
    'AP-H01',
    'AP-I01',
    'AP-L01',
    'AP-N01',
    'AP-O01',
    'AP-P01',
    'AP-Q01',
    'AP-R01',
    'AP-T01',
  ];

  for (const caseId of machineStopCases) {
    it(`stops adversarial case ${caseId}`, () => {
      const c = getCase(caseId);
      const remnant = createRemnant(c.remnant as never);
      const result = isSafeToAct(signed(remnant, keys), {
        publicKey: keys.publicKey,
        now: new Date('2026-09-08T16:00:00.000Z'),
      });
      assert.equal(result.safe, false, `${caseId} should STOP: ${result.stop.join('; ')}`);
      assert.ok(result.stop.length > 0);
    });
  }
});

describe('proof fail-closed', () => {
  it('rejects proof-marked evidence without payload', () => {
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Prove deployment',
      status: 'current',
      outputs: [{ kind: 'text', text: 'done' }],
      evidence: [{ type: 'proof', claim: 'deploy succeeded' }],
    });
    assert.equal(isProofEligible(remnant), false);
  });

  it('accepts proof evidence with a uri or digest', () => {
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Prove deployment',
      status: 'current',
      outputs: [{ kind: 'text', text: 'done' }],
      evidence: [{ type: 'proof', claim: 'deploy succeeded', uri: 'https://ci.example/run/1' }],
      verification: [{ claim: 'deploy succeeded', method: 'ci', result: 'pass', evidence: ['ci:1'] }],
    });
    assert.equal(isProofEligible(remnant), true);
  });

  it('does not resolve bare v0.1 proof as current proof in the store', () => {
    const store = createCurrentStore();
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Prove deployment',
      status: 'current',
      outputs: [{ kind: 'text', text: 'done' }],
      evidence: [{ type: 'proof', claim: 'deploy succeeded' }],
    });
    store.put(remnant);
    assert.equal(resolveCurrentProof(store, remnant.id), undefined);
  });

  it('resolves current proof when evidence is present', () => {
    const store = createCurrentStore();
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Prove deployment',
      status: 'current',
      outputs: [{ kind: 'text', text: 'done' }],
      evidence: [{ type: 'proof', claim: 'deploy succeeded', digest: 'a'.repeat(64) }],
      verification: [{ claim: 'deploy succeeded', method: 'ci', result: 'pass', evidence: ['ci:1'] }],
    });
    store.put(remnant);
    assert.deepEqual(resolveCurrentProof(store, remnant.id), remnant);
  });
});

describe('eng-status producer', () => {
  it('writes one card with the required fields', () => {
    const card = writeEngStatusCard({
      status: 'current',
      supersedes: ['art_prev'],
      authority: 'eng-lead@example.com',
      claim: 'Router patch ready for staging',
      evidence: [{ type: 'git-commit', uri: 'git:abc123' }],
      not_checked: ['Production SSO path'],
      lane: 'platform',
      stop: ['Do not deploy to production'],
      producer: 'cursor.agent',
    });
    assert.equal(card.status, 'current');
    assert.deepEqual(card.supersedes, ['art_prev']);
    assert.equal(card.authority, 'eng-lead@example.com');
    assert.equal(card.claim, 'Router patch ready for staging');
    assert.equal(card.evidence.length, 1);
    assert.deepEqual(card.not_checked, ['Production SSO path']);
    assert.equal(card.lane, 'platform');
    assert.deepEqual(card.stop, ['Do not deploy to production']);
  });

  it('produces a remnant envelope without calling external products', () => {
    const { card, remnant } = produceEngStatus({
      status: 'current',
      authority: 'eng-lead@example.com',
      claim: 'Lint clean on router patch',
      evidence: [{ type: 'ci', uri: 'https://ci.example/runs/9' }],
      not_checked: [],
      lane: 'platform',
      stop: [],
      producer: 'cursor.agent',
    });
    assert.equal(card.lane, 'platform');
    assert.equal(remnant.status, 'current');
    assert.ok(remnant.extensions?.['com.artifice.eng-status']);
  });
});

describe('conformance scorer exit behavior', () => {
  it('keeps SAFE labels exiting 0 and LEAK labels exiting 1', async () => {
    const { scoreResults } = await import('../src/conformance/index.ts');
    const safeOnly = scoreResults([{ caseId: 'AP-A01', score: 'SAFE' }]);
    assert.equal(safeOnly.scores.LEAK, 0);
    const leak = scoreResults([{ caseId: 'AP-A01', observed: ['marks_complete'] }]);
    assert.equal(leak.scores.LEAK, 1);
    assert.notEqual(leak.scores.LEAK, 0);
  });
});

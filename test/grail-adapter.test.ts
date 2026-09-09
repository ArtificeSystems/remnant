import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateSigningKeyPair, signRemnant } from '../src/crypto/index.ts';
import {
  createGrailAdapter,
  produceOperatorLock,
  writeOperatorLockCard,
} from '../src/index.ts';

const AS_OF = '2026-09-08T15:00:00.000Z';

function lockInput(overrides: Record<string, unknown> = {}) {
  return {
    status: 'current' as const,
    authority: 'operator@example.com',
    claim: 'Paper operator lock pinned',
    evidence: [{ type: 'operator-note', uri: 'note:pin-1' }],
    not_checked: ['live account binding', 'live order path'],
    lane: 'paper',
    stop: ['Do not call Grail'],
    as_of: AS_OF,
    producer: 'cursor.agent',
    ...overrides,
  };
}

describe('operator-lock producer', () => {
  it('writes one paper card with a null account and pinned-order policy', () => {
    const card = writeOperatorLockCard(lockInput());
    assert.equal(card.accountId, null);
    assert.equal(card.orders, 'allowed-when-pinned');
    assert.equal(card.paper, true);
    assert.equal(card.locked, true);
    assert.equal(card.authority, 'operator@example.com');
    assert.deepEqual(card.not_checked, ['live account binding', 'live order path']);
    assert.equal(card.lane, 'paper');
    assert.equal(card.as_of, AS_OF);
    assert.ok(card.stop.some((item) => /paper only/i.test(item)));
    assert.ok(card.stop.includes('Do not call Grail'));
  });

  it('maps first-class fields and keeps current distinct from locked', () => {
    const { card, remnant } = produceOperatorLock(
      lockInput({ locked: false, status: 'current' }),
    );
    assert.equal(card.accountId, null);
    assert.equal(card.paper, true);
    assert.equal(card.orders, 'allowed-when-pinned');
    assert.equal(card.locked, false);
    assert.equal(remnant.status, 'current');
    assert.equal(remnant.locked, false);
    assert.equal(remnant.authority, card.authority);
    assert.deepEqual(remnant.notChecked, card.not_checked);
    assert.equal(remnant.lane, card.lane);
    assert.deepEqual(remnant.stop, card.stop);
    assert.equal(remnant.asOf, card.as_of);
    const lock = remnant.extensions?.['com.artifice.operator-lock'] as {
      accountId: null;
      orders: string;
      paper: boolean;
    };
    assert.equal(lock.accountId, null);
    assert.equal(lock.orders, 'allowed-when-pinned');
    assert.equal(lock.paper, true);
  });

  it('refuses to write a card without as_of', () => {
    assert.throws(() => writeOperatorLockCard(lockInput({ as_of: '   ' })), /as_of/);
  });
});

describe('Grail adapter boundary', () => {
  const keys = generateSigningKeyPair();

  it('puts and resolves the current store head', () => {
    const adapter = createGrailAdapter();
    const { remnant } = produceOperatorLock(lockInput());
    adapter.put(remnant);
    assert.deepEqual(adapter.resolveCurrent(remnant.id), remnant);
    assert.equal(remnant.status, 'current');
    assert.equal(remnant.locked, true);
  });

  it('drops the previous head after supersede without treating locked as current', () => {
    const adapter = createGrailAdapter();
    const goal = 'Paper operator lock pinned';
    const { remnant: pinned } = produceOperatorLock(lockInput({ goal, locked: true }));
    adapter.put(pinned);

    const { remnant: newer } = produceOperatorLock(
      lockInput({
        goal,
        locked: false,
        supersedes: [pinned.id],
        evidence: [{ type: 'operator-note', uri: 'note:pin-2' }],
      }),
    );
    adapter.put(newer);
    assert.equal(adapter.resolveCurrent(pinned.id), undefined);
    assert.deepEqual(adapter.resolveCurrent(newer.id), newer);
    assert.equal(newer.status, 'current');
    assert.equal(newer.locked, false);
  });

  it('isSafeToAct stays false when as_of is missing', () => {
    const adapter = createGrailAdapter();
    const { remnant } = produceOperatorLock(lockInput());
    delete (remnant as { asOf?: string }).asOf;
    const signed = signRemnant(remnant, keys.privateKey);
    const result = adapter.isSafeToAct(signed, { publicKey: keys.publicKey });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((item) => item.includes('as_of is missing')));
  });

  it('does not apply a stale window unless the caller passes maxAge', () => {
    const adapter = createGrailAdapter();
    const { remnant } = produceOperatorLock(lockInput({ as_of: '2020-01-01T00:00:00.000Z' }));
    adapter.put(remnant);
    const signed = signRemnant(remnant, keys.privateKey);
    const omitted = adapter.isSafeToAct(signed, { publicKey: keys.publicKey });
    assert.equal(omitted.safe, true);

    const aged = adapter.isSafeToAct(signed, {
      publicKey: keys.publicKey,
      now: new Date('2026-09-08T16:00:00.000Z'),
      maxAge: 60 * 60 * 1000,
    });
    assert.equal(aged.safe, false);
    assert.ok(aged.stop.some((item) => item.includes('maxAge')));
  });
});
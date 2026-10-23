import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { generateSigningKeyPair, signRemnant } from '../src/crypto/index.ts';
import {
  createRemnant,
  createCurrentStore,
  CurrentStoreError,
  InMemoryCurrentStore,
  isSafeToAct,
  parseRemnant,
  serializeRemnant,
  validateRemnant,
  DEFAULT_EXTENSION_MAX_JSON_BYTES,
} from '../src/index.ts';
import { resolvePathWithinRoot, PathJailError } from '../src/path-jail.ts';

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

describe('security audit: isSafeToAct trusted keys', () => {
  const keys = generateSigningKeyPair();

  it('fails closed when no trusted public key is configured', () => {
    const result = isSafeToAct(signed(minimalCurrent(), keys), {});
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => s.includes('trusted public key')));
  });

  it('accepts trustedPublicKeys when the signature public key is listed', () => {
    const result = isSafeToAct(signed(minimalCurrent(), keys), {
      trustedPublicKeys: [keys.publicKey],
    });
    assert.equal(result.safe, true);
  });

  it('rejects when the signature key is not in the trusted set', () => {
    const other = generateSigningKeyPair();
    const result = isSafeToAct(signed(minimalCurrent(), keys), { publicKey: other.publicKey });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => s.includes('signature')));
  });
});

describe('security audit: store binding for isSafeToAct', () => {
  const keys = generateSigningKeyPair();

  it('requires the store to resolve the same remnant bytes when a store is passed', () => {
    const store = new InMemoryCurrentStore();
    const remnant = minimalCurrent();
    const alt = minimalCurrent({ outputs: [{ kind: 'text', text: 'Different.' }] });
    store.put(remnant);
    const result = isSafeToAct(signed(alt, keys), { publicKey: keys.publicKey, store });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => /store does not resolve/i.test(s)));
  });

  it('is safe when the store head matches the signed remnant', () => {
    const store = new InMemoryCurrentStore();
    const remnant = minimalCurrent();
    store.put(remnant);
    const result = isSafeToAct(signed(remnant, keys), { publicKey: keys.publicKey, store });
    assert.equal(result.safe, true);
  });
});

describe('security audit: store id reuse', () => {
  it('rejects a put that reuses an id with different content', () => {
    const store = new InMemoryCurrentStore();
    const first = minimalCurrent({ goal: 'Goal A' });
    store.put(first);
    const second = createRemnant({
      producer: 'test.agent',
      goal: 'Goal B',
      status: 'current',
      id: first.id,
      outputs: [{ kind: 'text', text: 'other' }],
      verification: [{ claim: 'checked', method: 'manual inspect', result: 'pass', evidence: ['note:ok'] }],
    });
    assert.throws(() => store.put(second), (err: unknown) => err instanceof CurrentStoreError);
  });

  it('allows an identical re-put for the same id', () => {
    const store = new InMemoryCurrentStore();
    const artifact = minimalCurrent();
    store.put(artifact);
    store.put(artifact);
    assert.deepEqual(store.resolveCurrent(artifact.id), artifact);
  });
});

describe('security audit: strict schema', () => {
  it('rejects unknown top-level fields', () => {
    const remnant = minimalCurrent();
    const raw = { ...remnant, extraField: 'nope' };
    const result = validateRemnant(raw);
    assert.equal(result.ok, false);
  });

  it('rejects unknown fields on parseRemnant', () => {
    const remnant = minimalCurrent({ extensions: { 'com.example': { ok: true } } });
    const raw = JSON.parse(serializeRemnant(remnant)) as Record<string, unknown>;
    raw.signedAfterTheFact = true;
    assert.throws(() => parseRemnant(raw), /Unrecognized key/i);
  });
});

describe('security audit: future asOf clock skew', () => {
  const keys = generateSigningKeyPair();

  it('rejects asOf beyond the default clock-skew allowance', () => {
    const now = new Date('2026-09-08T16:00:00.000Z');
    const remnant = minimalCurrent({ asOf: '2099-01-01T00:00:00.000Z' });
    const result = isSafeToAct(signed(remnant, keys), { publicKey: keys.publicKey, now });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => /future/i.test(s)));
  });

  it('honors staleAfterMs as a deprecated alias for maxAge', () => {
    const remnant = minimalCurrent({ asOf: '2020-01-01T00:00:00.000Z' });
    const result = isSafeToAct(signed(remnant, keys), {
      publicKey: keys.publicKey,
      now: new Date('2026-09-08T16:00:00.000Z'),
      staleAfterMs: 60 * 60 * 1000,
    });
    assert.equal(result.safe, false);
    assert.ok(result.stop.some((s) => s.includes('maxAge')));
  });
});

describe('security audit: prototype-safe store maps', () => {
  it('stores and resolves artifacts whose id is __proto__', () => {
    const store = new InMemoryCurrentStore();
    const artifact = createRemnant({
      producer: 'test',
      goal: 'proto goal',
      status: 'current',
      id: '__proto__',
      outputs: [{ kind: 'text', text: 'safe' }],
      verification: [{ claim: 'checked', method: 'manual inspect', result: 'pass', evidence: ['note:ok'] }],
    });
    store.put(artifact);
    assert.deepEqual(store.resolveCurrent('__proto__'), artifact);
  });
});

describe('security audit: extension limits', () => {
  it('rejects extensions that exceed the default JSON byte budget', () => {
    const big = 'x'.repeat(DEFAULT_EXTENSION_MAX_JSON_BYTES + 32);
    const base = minimalCurrent();
    const result = validateRemnant({
      ...base,
      extensions: { 'com.example': { blob: big } },
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'REMNANT_EXTENSIONS_TOO_LARGE'));
  });
});

describe('security audit: CLI file-root jail', () => {
  it('refuses inspect paths outside the file root with a one-line error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'remnant-jail-'));
    const outside = mkdtempSync(join(tmpdir(), 'remnant-out-'));
    const outsideFile = join(outside, 'secret.txt');
    writeFileSync(outsideFile, 'secret', 'utf8');
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Read outside',
      outputs: [{ kind: 'file', path: outsideFile, mediaType: 'text/plain' }],
    });
    const jsonPath = join(dir, 'handoff.json');
    writeFileSync(jsonPath, serializeRemnant(remnant), 'utf8');
    try {
      execFileSync('node', ['--import', 'tsx', 'src/cli.ts', 'inspect', jsonPath, '--file-root', dir], {
        cwd: resolve('.'),
        encoding: 'utf8',
        env: { ...process.env, DEBUG: undefined },
      });
      assert.fail('expected non-zero exit');
    } catch (err) {
      const e = err as { status?: number; stderr?: string; stdout?: string };
      assert.notEqual(e.status, 0);
      const out = `${e.stderr ?? ''}${e.stdout ?? ''}`;
      assert.match(out, /outside file root/i);
      assert.doesNotMatch(out, /^\s*at /m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('security audit: path jail helper', () => {
  it('blocks symlink hops that leave the root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'remnant-root-'));
    const outside = mkdtempSync(join(tmpdir(), 'remnant-escape-'));
    const inside = join(root, 'in.txt');
    writeFileSync(inside, 'ok', 'utf8');
    const link = join(root, 'link.txt');
    symlinkSync(join(outside, 'out.txt'), link);
    writeFileSync(join(outside, 'out.txt'), 'nope', 'utf8');
    await assert.rejects(() => resolvePathWithinRoot(link, root), PathJailError);
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
});

describe('security audit: durable store validation ordering', () => {
  it('does not persist invalid puts to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'remnant-store-'));
    const path = join(dir, 'current.json');
    const store = createCurrentStore({ path });
    const good = minimalCurrent({ goal: 'Persist' });
    store.put(good);
    const before = readFileSync(path, 'utf8');
    assert.throws(
      () => store.put(minimalCurrent({ goal: 'Persist' })),
      (err: unknown) => err instanceof CurrentStoreError,
    );
    assert.equal(readFileSync(path, 'utf8'), before);
    rmSync(dir, { recursive: true, force: true });
  });
});

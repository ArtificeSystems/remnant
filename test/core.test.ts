import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addOutput,
  addStop,
  addUnknown,
  addVerification,
  createRemnant,
  parseRemnant,
  PROTOCOL_VERSION,
  recordEffect,
  redactRemnant,
  renderRemnantForAgent,
  serializeRemnant,
  supersede,
  validateRemnant,
} from '../src/index.ts';
const fileOutput = {
  kind: 'file' as const,
  path: '/repo/src/auth/callback.ts',
  mediaType: 'text/typescript',
  sha256: 'a'.repeat(64),
};

function minimal(overrides: Record<string, unknown> = {}) {
  return createRemnant({
    producer: 'cursor.sonnet',
    goal: 'Fix the authentication redirect bug',
    outputs: [{ kind: 'text', text: 'Implementation completed.' }],
    ...overrides,
  });
}

describe('createRemnant', () => {
  it('applies defaults', () => {
    const remnant = minimal();
    assert.equal(remnant.protocolVersion, PROTOCOL_VERSION);
    assert.match(remnant.id, /^art_/);
    assert.equal(remnant.status, 'draft');
    assert.equal(remnant.asOf, remnant.createdAt);
    assert.deepEqual(remnant.assumptions, []);
    assert.deepEqual(remnant.unknowns, []);
    assert.deepEqual(remnant.verification, []);
    assert.deepEqual(remnant.stop, []);
    assert.equal(remnant.nextAction, null);
    assert.ok(Date.parse(remnant.createdAt));
  });

  it('does not default status to current', () => {
    assert.equal(minimal().status, 'draft');
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 20 }, () => minimal().id));
    assert.equal(ids.size, 20);
  });

  it('normalizes assumption shorthand', () => {
    const remnant = minimal({
      assumptions: ['DATABASE_URL is configured', { statement: 'User approved staging', basis: 'user' }],
    });
    assert.deepEqual(remnant.assumptions, [
      { statement: 'DATABASE_URL is configured', basis: 'unknown' },
      { statement: 'User approved staging', basis: 'user' },
    ]);
  });

  it('accepts all output variants', () => {
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Collect outputs',
      outputs: [
        { kind: 'text', text: 'hello' },
        { kind: 'data', data: { n: 1 } },
        fileOutput,
        { kind: 'reference', uri: 'https://example.com/spec' },
      ],
    });
    assert.equal(remnant.outputs.length, 4);
  });

  it('normalizes relative file paths when fileRoot is set', () => {
    const remnant = createRemnant(
      {
        producer: 'test',
        goal: 'Write a file',
        outputs: [{ kind: 'file', path: './out.xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
      },
      { fileRoot: '/home/workdir/remnants' },
    );
    assert.equal(remnant.outputs[0] && remnant.outputs[0].kind === 'file' && remnant.outputs[0].path, '/home/workdir/remnants/out.xlsx');
  });
});

describe('validation', () => {
  it('rejects relative file paths', () => {
    assert.throws(() =>
      createRemnant({
        producer: 'test',
        goal: 'Ship file',
        outputs: [{ kind: 'file', path: './out.xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
      }),
    );
    const result = validateRemnant({
      ...minimal(),
      outputs: [{ kind: 'file', path: './out.xlsx', mediaType: 'text/plain' }],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'REMNANT_RELATIVE_FILE_PATH'));
  });

  it('rejects invalid sha256', () => {
    const result = validateRemnant({
      ...minimal(),
      outputs: [{ kind: 'file', path: '/tmp/a.bin', mediaType: 'application/octet-stream', sha256: 'not-a-hash' }],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'REMNANT_INVALID_SHA256'));
  });

  it('rejects empty goal and no outputs', () => {
    const remnant = minimal();
    assert.equal(validateRemnant({ ...remnant, goal: '   ' }).ok, false);
    assert.equal(validateRemnant({ ...remnant, outputs: [] }).ok, false);
  });

  it('rejects pass verification without method or claim', () => {
    const remnant = minimal();
    const noMethod = validateRemnant({
      ...remnant,
      verification: [{ claim: 'tests pass', method: '', result: 'pass' }],
    });
    assert.ok(noMethod.errors.some((e) => e.code === 'REMNANT_VERIFICATION_NO_METHOD'));
    const noClaim = validateRemnant({
      ...remnant,
      verification: [{ claim: '', method: 'npm test', result: 'pass' }],
    });
    assert.ok(noClaim.errors.some((e) => e.code === 'REMNANT_VERIFICATION_PASS_WITHOUT_CLAIM'));
  });

  it('rejects self-supersession', () => {
    const remnant = minimal();
    const result = validateRemnant({ ...remnant, supersedes: [remnant.id] });
    assert.ok(result.errors.some((e) => e.code === 'REMNANT_SELF_SUPERSESSION'));
  });

  it('warns on duplicate supersession and completed effect without evidence', () => {
    const remnant = minimal();
    const dup = validateRemnant({ ...remnant, supersedes: ['a', 'a'] });
    assert.ok(dup.warnings.some((w) => w.code === 'REMNANT_DUPLICATE_SUPERSESSION'));
    const effect = validateRemnant({
      ...remnant,
      effects: [{ action: 'Sent email', status: 'completed' }],
    });
    assert.ok(effect.warnings.some((w) => w.code === 'REMNANT_EFFECT_COMPLETED_WITHOUT_EVIDENCE'));
  });

  it('warns when current has failed verification', () => {
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Ship',
      status: 'current',
      outputs: [{ kind: 'text', text: 'x' }],
      verification: [{ claim: 'tests pass', method: 'npm test', result: 'fail' }],
    });
    const result = validateRemnant(remnant);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.code === 'REMNANT_CURRENT_WITH_FAILED_VERIFICATION'));
  });
});

describe('serialize/parse', () => {
  it('roundtrips with semantic equality', () => {
    const remnant = createRemnant({
      producer: 'cursor.sonnet',
      goal: 'Fix auth',
      status: 'partial',
      outputs: [fileOutput, { kind: 'data', data: { ok: true } }],
      assumptions: ['DATABASE_URL is configured'],
      unknowns: ['SSO untested'],
      verification: [
        {
          claim: 'TypeScript compiles',
          method: 'npm run build',
          result: 'pass',
          evidence: ['exit_code:0'],
          doesNotProve: ['SSO works'],
        },
      ],
      stop: ['Do not deploy'],
      evidence: [{ type: 'git-commit', uri: 'git:abc123', claim: 'HEAD at abc123' }],
      extensions: { 'com.artifice.finance': { n: 1 } },
    });
    const json = serializeRemnant(remnant);
    const parsed = parseRemnant(json);
    assert.deepEqual(parsed, remnant);
    assert.equal(serializeRemnant(parsed), json);
  });

  it('preserves unknown extension fields', () => {
    const remnant = minimal({ extensions: { 'com.acme.cicd': { job: 9 }, 'com.artifice.finance': { x: true } } });
    const parsed = parseRemnant(serializeRemnant(remnant));
    assert.deepEqual(parsed.extensions, remnant.extensions);
  });

  it('uses deterministic key order', () => {
    const remnant = minimal({ extensions: { z: 1, a: 2 } });
    const json = serializeRemnant(remnant);
    assert.ok(json.indexOf('"protocolVersion"') < json.indexOf('"id"'));
    assert.ok(json.indexOf('"a"') < json.indexOf('"z"'));
  });
});

describe('helpers', () => {
  it('returns new objects', () => {
    const remnant = minimal();
    const next = addUnknown(addStop(remnant, 'Do not deploy'), 'SSO untested');
    assert.notEqual(next, remnant);
    assert.deepEqual(remnant.unknowns, []);
    assert.deepEqual(next.stop, ['Do not deploy']);
    const withOut = addOutput(next, { kind: 'text', text: 'more' });
    const withV = addVerification(withOut, { claim: 'builds', method: 'npm run build', result: 'pass' });
    const withE = recordEffect(withV, { action: 'notified', status: 'completed', evidence: ['msg:1'] });
    assert.equal(withE.effects?.length, 1);
  });

  it('supersede assigns a new id, links previous, and does not inherit verification', () => {
    const previous = createRemnant({
      producer: 'a',
      goal: 'Fix login',
      status: 'current',
      outputs: [{ kind: 'text', text: 'old' }],
      verification: [{ claim: 'old check', method: 'manual', result: 'pass' }],
    });
    const snapshot = structuredClone(previous);
    const next = supersede(previous, {
      producer: 'b',
      goal: previous.goal,
      status: 'current',
      outputs: [{ kind: 'text', text: 'new' }],
    });
    assert.notEqual(next.id, previous.id);
    assert.deepEqual(next.supersedes, [previous.id]);
    assert.deepEqual(next.verification, []);
    assert.deepEqual(previous, snapshot);
  });
});

describe('render and redact', () => {
  it('renders a compact agent view without mutating', () => {
    const remnant = createRemnant({
      producer: 'cursor.sonnet',
      goal: 'Fix authentication redirect bug',
      status: 'current',
      outputs: [fileOutput],
      assumptions: ['DATABASE_URL is configured in staging'],
      unknowns: ['Production SSO not tested'],
      verification: [{ claim: 'TypeScript project builds', method: 'npm run build', result: 'pass' }],
      stop: ['Do not deploy to production without approval'],
      nextAction: 'Deploy to staging',
    });
    const rendered = renderRemnantForAgent(remnant);
    assert.match(rendered, /STATUS: current/);
    assert.match(rendered, /STOP/);
    assert.match(rendered, /NEXT/);
    assert.equal(remnant.status, 'current');
  });

  it('redacts obvious secrets best-effort', () => {
    const remnant = minimal({
      outputs: [{ kind: 'text', text: 'token: "supersecretvalue123" and Bearer abcdefghijklmnop' }],
    });
    const redacted = redactRemnant(remnant);
    const text = remnant.outputs[0];
    assert.ok(text && text.kind === 'text' && text.text.includes('Bearer'));
    const out = redacted.outputs[0];
    assert.ok(out && out.kind === 'text' && !out.text.includes('Bearer abcdefghijklmnop'));
  });
});

describe('partial work', () => {
  it('allows partial status without claiming completeness', () => {
    const remnant = createRemnant({
      producer: 'cursor.engineer',
      goal: 'Add routing without changing existing behavior',
      status: 'partial',
      outputs: [fileOutput],
      unknowns: ['POST path has not been exercised'],
      stop: ['Do not mark routing complete until the POST path is exercised'],
    });
    assert.equal(remnant.status, 'partial');
    assert.equal(validateRemnant(remnant).ok, true);
  });
});

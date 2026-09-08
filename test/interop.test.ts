import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalBytes, createRemnant, parseRemnant, serializeRemnant } from '../src/index.ts';
import { fromA2AArtifact, toA2AArtifact } from '../src/a2a/index.ts';
import { fromMcpResource, fromMcpStructuredContent, toMcpResource, toMcpStructuredContent } from '../src/mcp/index.ts';
import { generateSigningKeyPair, signRemnant, verifyRemnantSignature } from '../src/crypto/index.ts';

function sample() {
  return createRemnant({
    producer: 'cursor.sonnet',
    goal: 'Fix authentication redirect bug',
    status: 'current',
    outputs: [
      { kind: 'text', text: 'Implementation completed.' },
      { kind: 'file', path: '/repo/src/auth/callback.ts', mediaType: 'text/typescript' },
    ],
    stop: ['Do not deploy to production'],
  });
}

function lowTrust() {
  return createRemnant({
    producer: 'cursor.sonnet',
    goal: 'Summarize the login bug without changing code.',
    status: 'draft',
    outputs: [{ kind: 'text', text: 'Redirect drops the exchange code.' }],
    stop: ['Do not mutate the repo'],
    evidence: [{ type: 'git-commit', uri: 'git:deadbeef', claim: 'working tree at deadbeef' }],
  });
}

function assertTrustUnchanged(original: ReturnType<typeof createRemnant>, back: ReturnType<typeof createRemnant>) {
  assert.equal(back.status, original.status);
  assert.equal(back.status, 'draft');
  assert.deepEqual(back.verification, []);
  assert.deepEqual(back.stop, original.stop);
  assert.deepEqual(back.evidence, original.evidence);
  assert.deepEqual(back.unknowns, original.unknowns);
  assert.deepEqual(parseRemnant(serializeRemnant(back)), parseRemnant(serializeRemnant(original)));
}

describe('A2A', () => {
  it('roundtrips through an Artifact without depending on A2A as a runtime', () => {
    const remnant = sample();
    const artifact = toA2AArtifact(remnant);
    assert.equal(artifact.artifactId, remnant.id);
    assert.ok(artifact.parts.length >= 2);
    assert.equal(artifact.parts[0]?.kind, 'text');
    assert.equal(artifact.parts[1]?.kind, 'file');
    const back = fromA2AArtifact(artifact);
    assert.deepEqual(parseRemnant(serializeRemnant(back)), parseRemnant(serializeRemnant(remnant)));
  });

  it('does not upgrade trust on roundtrip', () => {
    const remnant = lowTrust();
    assertTrustUnchanged(remnant, fromA2AArtifact(toA2AArtifact(remnant)));
  });
});

describe('MCP', () => {
  it('roundtrips through resource text and structuredContent', () => {
    const remnant = sample();
    const resource = toMcpResource(remnant);
    assert.equal(resource.uri, `remnant://${remnant.id}`);
    assert.deepEqual(fromMcpResource(resource), remnant);
    const structured = toMcpStructuredContent(remnant);
    assert.equal(structured.content[0]?.type, 'text');
    assert.deepEqual(fromMcpStructuredContent(structured), remnant);
  });

  it('does not upgrade trust on roundtrip', () => {
    const remnant = lowTrust();
    assertTrustUnchanged(remnant, fromMcpResource(toMcpResource(remnant)));
    assertTrustUnchanged(remnant, fromMcpStructuredContent(toMcpStructuredContent(remnant)));
  });
});

describe('crypto', () => {
  it('signs canonical Remnant bytes excluding the signature container', () => {
    const remnant = sample();
    const bytes = canonicalBytes(remnant);
    const again = canonicalBytes(remnant);
    assert.deepEqual(bytes, again);
    const json = new TextDecoder().decode(bytes);
    assert.equal(json, JSON.stringify(JSON.parse(json)));
    assert.equal(json.includes('signature'), false);
    assert.notEqual(json, serializeRemnant(remnant));

    const keys = generateSigningKeyPair();
    const signed = signRemnant(remnant, keys.privateKey);
    assert.equal(signed.signature.alg, 'ed25519');
    assert.equal(verifyRemnantSignature(signed, keys.publicKey), true);
    assert.deepEqual(canonicalBytes(signed.remnant), bytes);

    const tampered = { ...signed, remnant: { ...signed.remnant, goal: 'Ship to production' } };
    assert.equal(verifyRemnantSignature(tampered, keys.publicKey), false);
    const other = generateSigningKeyPair();
    assert.equal(verifyRemnantSignature(signed, other.publicKey), false);
  });
});

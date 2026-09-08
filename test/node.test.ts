import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemnant } from '../src/index.ts';
import { auditRemnant, inspectFileOutput, verifyFileHash } from '../src/node/index.ts';

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'remnant-'));
}

describe('node file inspection', () => {
  it('inspects an existing file and verifies hash', async () => {
    const dir = await tempDir();
    const path = join(dir, 'note.txt');
    const body = 'hello remnant';
    await writeFile(path, body);
    const sha = createHash('sha256').update(body).digest('hex');
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Write a note',
      outputs: [{ kind: 'file', path, mediaType: 'text/plain', sha256: sha, size: body.length }],
    });
    const output = remnant.outputs[0];
    assert.ok(output && output.kind === 'file');
    const inspection = await inspectFileOutput(output, { hash: true, sniffMediaType: true });
    assert.equal(inspection.exists, true);
    assert.equal(inspection.isFile, true);
    assert.equal(inspection.hashMatches, true);
    assert.equal(await verifyFileHash(path, sha), true);
    const audit = await auditRemnant(remnant, { inspectFiles: true, verifyHashes: true });
    assert.equal(audit.diagnostics.filter((d) => d.severity === 'error').length, 0);
  });

  it('detects missing files', async () => {
    const path = join(await tempDir(), 'missing.txt');
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Claim a file',
      outputs: [{ kind: 'file', path, mediaType: 'text/plain' }],
    });
    const output = remnant.outputs[0];
    assert.ok(output && output.kind === 'file');
    const inspection = await inspectFileOutput(output);
    assert.equal(inspection.exists, false);
    const audit = await auditRemnant(remnant, { inspectFiles: true });
    assert.ok(audit.diagnostics.some((d) => d.code === 'REMNANT_FILE_MISSING'));
  });

  it('detects sha mismatch', async () => {
    const dir = await tempDir();
    const path = join(dir, 'note.txt');
    await writeFile(path, 'actual');
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Hash theater',
      outputs: [{ kind: 'file', path, mediaType: 'text/plain', sha256: 'b'.repeat(64) }],
    });
    const output = remnant.outputs[0];
    assert.ok(output && output.kind === 'file');
    const inspection = await inspectFileOutput(output, { hash: true });
    assert.equal(inspection.hashMatches, false);
    const audit = await auditRemnant(remnant, { inspectFiles: true, verifyHashes: true });
    assert.ok(audit.diagnostics.some((d) => d.code === 'REMNANT_FILE_HASH_MISMATCH'));
  });

  it('detects size mismatch', async () => {
    const dir = await tempDir();
    const path = join(dir, 'note.txt');
    await writeFile(path, 'abc');
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Size check',
      outputs: [{ kind: 'file', path, mediaType: 'text/plain', size: 99 }],
    });
    const audit = await auditRemnant(remnant, { inspectFiles: true, verifyHashes: false });
    assert.ok(audit.diagnostics.some((d) => d.code === 'REMNANT_FILE_SIZE_MISMATCH'));
  });

  it('sniffs pdf vs declared mismatch', async () => {
    const dir = await tempDir();
    const path = join(dir, 'report.bin');
    await writeFile(path, '%PDF-1.7\n%');
    const remnant = createRemnant({
      producer: 'test',
      goal: 'Format disguise',
      outputs: [{ kind: 'file', path, mediaType: 'image/png' }],
    });
    const output = remnant.outputs[0];
    assert.ok(output && output.kind === 'file');
    const inspection = await inspectFileOutput(output, { sniffMediaType: true, hash: false });
    assert.equal(inspection.detectedMediaType, 'application/pdf');
    assert.equal(inspection.mediaTypeMatches, false);
  });

  it('follows symlink targets when hashing', async () => {
    const dir = await tempDir();
    const target = join(dir, 'real.txt');
    const link = join(dir, 'alias.txt');
    const body = 'target-bytes';
    await writeFile(target, body);
    try {
      await symlink(target, link);
    } catch {
      return;
    }
    const sha = createHash('sha256').update(body).digest('hex');
    const inspection = await inspectFileOutput(
      { kind: 'file', path: link, mediaType: 'text/plain', sha256: sha },
      { hash: true },
    );
    assert.equal(inspection.isSymlink, true);
    assert.equal(inspection.hashMatches, true);
  });

  it('records permission denied', async () => {
    if (process.platform === 'win32') return;
    const dir = await tempDir();
    const hidden = join(dir, 'secret');
    await mkdir(hidden, { mode: 0o000 });
    const path = join(hidden, 'x.txt');
    const inspection = await inspectFileOutput({ kind: 'file', path, mediaType: 'text/plain' });
    await chmod(hidden, 0o700);
    assert.ok(inspection.error === 'EACCES' || inspection.exists === false);
  });
});

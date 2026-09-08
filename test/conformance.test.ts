import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { validateRemnant } from '../src/index.ts';

const casesPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'conformance', 'cases.json');

describe('adversarial cases', () => {
  it('includes cases A–T', async () => {
    const cases = JSON.parse(await readFile(casesPath, 'utf8')) as Array<{ id: string; name: string; remnant: unknown }>;
    assert.equal(cases.length, 20);
    const ids = cases.map((c) => c.id);
    assert.deepEqual(
      ids,
      [
        'AP-A01',
        'AP-B01',
        'AP-C01',
        'AP-D01',
        'AP-E01',
        'AP-F01',
        'AP-G01',
        'AP-H01',
        'AP-I01',
        'AP-J01',
        'AP-K01',
        'AP-L01',
        'AP-M01',
        'AP-N01',
        'AP-O01',
        'AP-P01',
        'AP-Q01',
        'AP-R01',
        'AP-S01',
        'AP-T01',
      ],
    );
  });

  it('rejects relative file paths (working-directory lie)', async () => {
    const cases = JSON.parse(await readFile(casesPath, 'utf8')) as Array<{ id: string; remnant: unknown }>;
    const k = cases.find((c) => c.id === 'AP-K01');
    assert.ok(k);
    const result = validateRemnant(k.remnant);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === 'REMNANT_RELATIVE_FILE_PATH'));
  });

  it('keeps schema-valid cases parseable except K', async () => {
    const cases = JSON.parse(await readFile(casesPath, 'utf8')) as Array<{ id: string; remnant: unknown }>;
    for (const c of cases) {
      if (c.id === 'AP-K01') continue;
      const result = validateRemnant(c.remnant);
      assert.equal(result.ok, true, `${c.id}: ${result.errors.map((e) => e.message).join('; ')}`);
    }
  });
});

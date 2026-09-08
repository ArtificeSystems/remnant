#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseRemnant, renderRemnantForAgent, serializeRemnant, validateRemnant } from './index.js';
import { auditRemnant } from './node/audit.js';
import { inspectFileOutput } from './node/inspect-file.js';

function usage(): never {
  console.error(`Usage:
  remnant validate <file.json>
  remnant inspect <file.json>
  remnant verify-files <file.json>
  remnant render <file.json>`);
  process.exit(2);
}

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

const [cmd, file] = process.argv.slice(2);
if (!cmd || !file) usage();

const raw = await readFile(file, 'utf8');

if (cmd === 'validate') {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail('Invalid JSON');
  }
  const result = validateRemnant(value);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

let remnant;
try {
  remnant = parseRemnant(raw);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}

if (cmd === 'inspect') {
  const audit = await auditRemnant(remnant, { inspectFiles: true, verifyHashes: true });
  console.log(serializeRemnant(remnant));
  console.log(JSON.stringify(audit, null, 2));
  process.exit(audit.diagnostics.some((d) => d.severity === 'error') ? 1 : 0);
}

if (cmd === 'verify-files') {
  const files = remnant.outputs.filter((o) => o.kind === 'file');
  if (files.length === 0) {
    console.log(JSON.stringify({ ok: true, inspections: [] }, null, 2));
    process.exit(0);
  }
  const inspections = [];
  let ok = true;
  for (const output of files) {
    if (output.kind !== 'file') continue;
    const inspection = await inspectFileOutput(output, { hash: true, sniffMediaType: true });
    inspections.push(inspection);
    if (!inspection.exists || !inspection.isFile || inspection.hashMatches === false) ok = false;
  }
  console.log(JSON.stringify({ ok, inspections }, null, 2));
  process.exit(ok ? 0 : 1);
}

if (cmd === 'render') {
  console.log(renderRemnantForAgent(remnant));
  process.exit(0);
}

usage();

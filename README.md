# @artifice/remnant

Durable work-state for agent handoffs.

> **A Remnant is an accountable unit of completed or partial work that another agent can safely inspect and continue from without reconstructing the conversation that produced it.**

Zero reread. Zero redo. No silent risk.

This package is the v0.1 TypeScript implementation of Remnant Protocol. It is not an agent runtime, workflow engine, or memory system.

## Install

```bash
npm install @artifice/remnant
```

Node.js 20+. ESM.

## Create

```ts
import { createRemnant, serializeRemnant } from '@artifice/remnant';

const remnant = createRemnant({
  producer: 'cursor.sonnet',
  goal: 'Fix authentication redirect bug',
  status: 'current',
  outputs: [{ kind: 'text', text: 'Implementation completed.' }],
  unknowns: ['Production SSO has not been exercised'],
  stop: ['Do not deploy to production without explicit approval'],
  nextAction: 'Deploy to staging and exercise the SSO callback.',
});

process.stdout.write(serializeRemnant(remnant));
```

`status` defaults to `draft`. The SDK will not silently default to `current`.

Mechanical fields (`protocolVersion`, `id`, `createdAt`, `asOf`) are generated.

Assumption shorthand `'DATABASE_URL is configured'` becomes `{ statement, basis: 'unknown' }`.

## Validate and render

```ts
import { parseRemnant, validateRemnant, renderRemnantForAgent } from '@artifice/remnant';

const remnant = parseRemnant(json);
const result = validateRemnant(value);
const prompt = renderRemnantForAgent(remnant);
```

Validation checks shape and universal invariants. It does not claim the Remnant is true.

There is no `isSafeToAct()`. Use diagnostics. Reality outranks the envelope.

## File inspection (Node)

```ts
import { inspectFileOutput, verifyFileHash, auditRemnant } from '@artifice/remnant/node';

const inspection = await inspectFileOutput(fileOutput);
const audit = await auditRemnant(remnant, { inspectFiles: true, verifyHashes: true });
```

Local `FileOutput.path` must be absolute. Hashing follows symlink targets. A matching hash is not proof the work inside the file is correct.

## CLI

```bash
npx remnant validate remnant.json
remnant inspect remnant.json
remnant verify-files remnant.json
remnant render remnant.json
```

## Semantics (short)

- `status` is lifecycle, not verification.
- Verification is scoped evidence. `doesNotProve` exists because nearby evidence is overgeneralized.
- `nextAction` is advisory. `stop` and unknowns outrank it.
- If two current Remnants conflict and neither supersedes the other, currentness is unresolved.
- Unknown extension fields are ignored by Core.

See `spec/` for the protocol, behavioral contract, and adversarial battery.

## License

Apache-2.0

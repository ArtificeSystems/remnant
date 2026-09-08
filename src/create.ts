import { PROTOCOL_VERSION, type Assumption, type CreateRemnantInput, type CreateRemnantOptions, type Remnant, type RemnantOutput } from './remnant.js';
import { isAbsolutePath, validateRemnant } from './schema.js';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Crockford ULID. Core stays off Node APIs. */
export function ulid(now = Date.now()): string {
  let time = now;
  const timeChars = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = CROCKFORD[time % 32]!;
    time = Math.floor(time / 32);
  }
  const rand = randomBytes(16);
  const randChars = new Array<string>(16);
  for (let i = 0; i < 16; i++) {
    randChars[i] = CROCKFORD[rand[i]! % 32]!;
  }
  return timeChars.join('') + randChars.join('');
}

export function generateRemnantId(now?: Date): string {
  return `art_${ulid(now?.getTime())}`;
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function normalizeAssumption(value: string | Assumption): Assumption {
  if (typeof value === 'string') {
    return { statement: value, basis: 'unknown' };
  }
  return { ...value };
}

export function resolveFilePath(path: string, fileRoot?: string): string {
  if (isAbsolutePath(path)) return path;
  if (!fileRoot) return path;
  const root = fileRoot.replace(/[\\/]+$/, '');
  const rel = path.replace(/^\.[\\/]/, '');
  const sep = root.includes('\\') && !root.startsWith('/') ? '\\' : '/';
  return `${root}${sep}${rel}`;
}

export class RemnantValidationError extends Error {
  readonly diagnostics;

  constructor(diagnostics: ReturnType<typeof validateRemnant>['errors']) {
    super(diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
    this.name = 'RemnantValidationError';
    this.diagnostics = diagnostics;
  }
}

export function createRemnant(input: CreateRemnantInput, options: CreateRemnantOptions = {}): Remnant {
  const now = options.now ?? new Date();
  const createdAt = input.createdAt ?? toIso(now);
  const remnant: Remnant = {
    protocolVersion: PROTOCOL_VERSION,
    id: input.id ?? generateRemnantId(now),
    createdAt,
    asOf: input.asOf ?? createdAt,
    producer: input.producer,
    goal: input.goal,
    status: input.status ?? 'draft',
    outputs: input.outputs.map((output) => {
      if (output.kind === 'file') {
        return { ...output, path: resolveFilePath(output.path, options.fileRoot) };
      }
      return { ...output };
    }) as RemnantOutput[],
    assumptions: (input.assumptions ?? []).map(normalizeAssumption),
    unknowns: [...(input.unknowns ?? [])],
    verification: (input.verification ?? []).map((v) => ({ ...v })),
    stop: [...(input.stop ?? [])],
    nextAction: input.nextAction ?? null,
  };

  if (input.supersedes && input.supersedes.length > 0) {
    remnant.supersedes = [...input.supersedes];
  }
  if (input.effects && input.effects.length > 0) {
    remnant.effects = input.effects.map((e) => ({ ...e }));
  }
  if (input.extensions) {
    remnant.extensions = { ...input.extensions };
  }

  const result = validateRemnant(remnant);
  if (!result.ok) {
    throw new RemnantValidationError(result.errors);
  }
  return remnant;
}

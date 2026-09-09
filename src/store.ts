import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Remnant } from './remnant.js';
import { validateRemnant } from './schema.js';

export class CurrentStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurrentStoreError';
  }
}

export interface CurrentStore {
  put(artifact: Remnant): void;
  resolveCurrent(id: string): Remnant | undefined;
}

interface StoreState {
  artifacts: Record<string, Remnant>;
  currentByGoal: Record<string, string>;
}

function emptyState(): StoreState {
  return { artifacts: {}, currentByGoal: {} };
}

function assertValid(artifact: Remnant): void {
  const result = validateRemnant(artifact);
  if (!result.ok) {
    throw new CurrentStoreError(result.errors.map((e) => e.message).join('; '));
  }
}

/**
 * In-process current store. Tracks one current Remnant per exact goal string.
 * A new `current` without `supersedes` is rejected when a current already exists for that goal.
 */
export class InMemoryCurrentStore implements CurrentStore {
  private state: StoreState = emptyState();

  put(artifact: Remnant): void {
    assertValid(artifact);
    this.state.artifacts[artifact.id] = artifact;

    if (artifact.status !== 'current') return;

    const existingId = this.state.currentByGoal[artifact.goal];
    const hasSupersedes = (artifact.supersedes?.length ?? 0) > 0;

    if (existingId && !hasSupersedes) {
      throw new CurrentStoreError(
        `current already exists for goal without supersede: ${artifact.goal}`,
      );
    }

    if (hasSupersedes) {
      for (const prevId of artifact.supersedes ?? []) {
        const prev = this.state.artifacts[prevId];
        if (!prev) {
          throw new CurrentStoreError(`supersedes target not in store: ${prevId}`);
        }
        if (this.state.currentByGoal[prev.goal] === prevId) {
          delete this.state.currentByGoal[prev.goal];
        }
      }
    }

    this.state.currentByGoal[artifact.goal] = artifact.id;
  }

  resolveCurrent(id: string): Remnant | undefined {
    const artifact = this.state.artifacts[id];
    if (!artifact) return undefined;
    if (this.state.currentByGoal[artifact.goal] !== id) return undefined;
    return artifact;
  }

  /** Visible for tests and file hydration. */
  snapshot(): StoreState {
    return structuredClone(this.state);
  }

  /** Visible for tests and file hydration. */
  restore(state: StoreState): void {
    this.state = structuredClone(state);
  }
}

export interface FileCurrentStoreOptions {
  path: string;
}

/**
 * Durable current store backed by a local JSON file.
 */
export class FileCurrentStore extends InMemoryCurrentStore {
  private readonly path: string;

  constructor(options: FileCurrentStoreOptions) {
    super();
    this.path = options.path;
    try {
      const raw = readFileSync(this.path, 'utf8');
      this.restore(JSON.parse(raw) as StoreState);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  override put(artifact: Remnant): void {
    super.put(artifact);
    this.flush();
  }

  private flush(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(this.snapshot(), null, 2)}\n`, 'utf8');
  }
}

export function createCurrentStore(options?: FileCurrentStoreOptions): CurrentStore {
  return options ? new FileCurrentStore(options) : new InMemoryCurrentStore();
}

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Remnant } from './remnant.js';
import { remnantsEqual } from './remnant-equality.js';
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

export interface StoreState {
  artifacts: Record<string, Remnant>;
  currentByGoal: Record<string, string>;
}

function createMap<V>(): Map<string, V> {
  return new Map<string, V>();
}

function mapFromRecord<V>(record: Record<string, V>): Map<string, V> {
  const map = createMap<V>();
  for (const key of Object.keys(record)) {
    map.set(key, record[key]!);
  }
  return map;
}

function recordFromMap<V>(map: Map<string, V>): Record<string, V> {
  const out = Object.create(null) as Record<string, V>;
  for (const [key, value] of map) {
    out[key] = value;
  }
  return out;
}

interface MutableStoreState {
  artifacts: Map<string, Remnant>;
  currentByGoal: Map<string, string>;
}

function emptyMutableState(): MutableStoreState {
  return { artifacts: createMap(), currentByGoal: createMap() };
}

function assertValid(artifact: Remnant): void {
  const result = validateRemnant(artifact);
  if (!result.ok) {
    throw new CurrentStoreError(result.errors.map((e) => e.message).join('; '));
  }
}

function applyPut(state: MutableStoreState, artifact: Remnant): MutableStoreState {
  assertValid(artifact);

  const existing = state.artifacts.get(artifact.id);
  if (existing) {
    if (remnantsEqual(existing, artifact)) {
      return state;
    }
    throw new CurrentStoreError(`artifact id already exists with different content: ${artifact.id}`);
  }

  const next: MutableStoreState = {
    artifacts: new Map(state.artifacts),
    currentByGoal: new Map(state.currentByGoal),
  };
  next.artifacts.set(artifact.id, artifact);

  if (artifact.status !== 'current') {
    return next;
  }

  const existingId = next.currentByGoal.get(artifact.goal);
  const hasSupersedes = (artifact.supersedes?.length ?? 0) > 0;

  if (existingId && !hasSupersedes) {
    throw new CurrentStoreError(
      `current already exists for goal without supersede: ${artifact.goal}`,
    );
  }

  if (hasSupersedes) {
    for (const prevId of artifact.supersedes ?? []) {
      const prev = next.artifacts.get(prevId);
      if (!prev) {
        throw new CurrentStoreError(`supersedes target not in store: ${prevId}`);
      }
      if (next.currentByGoal.get(prev.goal) === prevId) {
        next.currentByGoal.delete(prev.goal);
      }
    }
  }

  next.currentByGoal.set(artifact.goal, artifact.id);
  return next;
}

function stateToSnapshot(state: MutableStoreState): StoreState {
  return {
    artifacts: recordFromMap(state.artifacts),
    currentByGoal: recordFromMap(state.currentByGoal),
  };
}

function snapshotToState(snapshot: StoreState): MutableStoreState {
  return {
    artifacts: mapFromRecord(snapshot.artifacts ?? Object.create(null)),
    currentByGoal: mapFromRecord(snapshot.currentByGoal ?? Object.create(null)),
  };
}

/**
 * In-process current store. Tracks one current Remnant per exact goal string.
 * A new `current` without `supersedes` is rejected when a current already exists for that goal.
 */
export class InMemoryCurrentStore implements CurrentStore {
  private state: MutableStoreState = emptyMutableState();

  put(artifact: Remnant): void {
    this.state = applyPut(this.state, artifact);
  }

  resolveCurrent(id: string): Remnant | undefined {
    const artifact = this.state.artifacts.get(id);
    if (!artifact) return undefined;
    if (this.state.currentByGoal.get(artifact.goal) !== id) return undefined;
    return artifact;
  }

  /** Visible for tests and file hydration. */
  snapshot(): StoreState {
    return stateToSnapshot(this.state);
  }

  /** Visible for tests and file hydration. */
  restore(state: StoreState): void {
    this.state = snapshotToState(state);
  }
}

export interface FileCurrentStoreOptions {
  path: string;
}

function writeFileAtomic(path: string, contents: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tempPath = join(dir, `.${basename(path) || 'store'}.tmp-${process.pid}`);
  const fd = openSync(tempPath, 'w');
  try {
    writeSync(fd, Buffer.from(contents, 'utf8'));
    try {
      fsyncSync(fd);
    } catch {
      /* fsync may be unavailable on some filesystems */
    }
    closeSync(fd);
    renameSync(tempPath, path);
  } catch (err) {
    try {
      closeSync(fd);
    } catch {
      /* ignore */
    }
    throw err;
  }
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
    const before = this.snapshot();
    try {
      super.put(artifact);
      this.flush();
    } catch (err) {
      this.restore(before);
      throw err;
    }
  }

  private flush(): void {
    const payload = `${JSON.stringify(this.snapshot(), null, 2)}\n`;
    writeFileAtomic(this.path, payload);
  }
}

export function createCurrentStore(options?: FileCurrentStoreOptions): CurrentStore {
  return options ? new FileCurrentStore(options) : new InMemoryCurrentStore();
}

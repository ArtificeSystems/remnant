import type { SignedRemnant } from '../crypto/index.js';
import type { Remnant } from '../remnant.js';
import { isSafeToAct, type SafeToActResult } from '../safe.js';
import { createCurrentStore, type CurrentStore } from '../store.js';

/**
 * Caller-supplied STOP options for the host adapter.
 * `maxAge` is honored only when the caller passes it. There is no default stale window.
 */
export interface HostAdapterSafeToActOptions {
  publicKey?: string;
  now?: Date;
  /** Caller-supplied max age in ms for `asOf`. Omit to skip the age check. */
  maxAge?: number;
}

/**
 * Thin host-facing boundary a caller can bind to its runtime later.
 *
 * This is a function/module boundary, not a platform and not an HTTP client.
 * `current` means store head. `locked` stays on the artifact and means authority authorized.
 */
export interface HostAdapter {
  put(artifact: Remnant): void;
  resolveCurrent(id: string): Remnant | undefined;
  isSafeToAct(signed: SignedRemnant, options?: HostAdapterSafeToActOptions): SafeToActResult;
}

export interface CreateHostAdapterOptions {
  store?: CurrentStore;
}

/**
 * Bind put / resolveCurrent / isSafeToAct to a current store.
 * `isSafeToAct` stays false when `as_of` is missing. Optional `maxAge` is
 * forwarded only if the caller passes it.
 */
export function createHostAdapter(options: CreateHostAdapterOptions = {}): HostAdapter {
  const store = options.store ?? createCurrentStore();

  return {
    put(artifact) {
      store.put(artifact);
    },
    resolveCurrent(id) {
      return store.resolveCurrent(id);
    },
    isSafeToAct(signed, callOptions = {}) {
      return isSafeToAct(signed, {
        store,
        publicKey: callOptions.publicKey,
        now: callOptions.now,
        maxAge: callOptions.maxAge,
      });
    },
  };
}

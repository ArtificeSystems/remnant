import type { Remnant } from './remnant.js';
import { canonicalBytes } from './serialize.js';

/** Compare two Remnants by canonical signed payload bytes. */
export function remnantsEqual(a: Remnant, b: Remnant): boolean {
  const left = canonicalBytes(a);
  const right = canonicalBytes(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

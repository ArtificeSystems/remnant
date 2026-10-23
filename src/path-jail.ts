import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

export class PathJailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathJailError';
  }
}

/**
 * Resolve `targetPath` to a real path and ensure it stays within `root` (also resolved).
 * Rejects paths outside the root, including via `..` and symlink hops.
 */
export async function resolvePathWithinRoot(
  targetPath: string,
  root: string,
): Promise<string> {
  const rootReal = await realpath(resolve(root));
  const candidate = resolve(targetPath);
  let resolved: string;
  try {
    resolved = await realpath(candidate);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new PathJailError(`path is outside file root: ${targetPath}`);
    }
    throw err;
  }
  const prefix = rootReal.endsWith('/') ? rootReal : `${rootReal}/`;
  if (resolved !== rootReal && !resolved.startsWith(prefix)) {
    throw new PathJailError(`path is outside file root: ${targetPath}`);
  }
  return resolved;
}

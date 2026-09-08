import { lstat, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FileOutput } from '../remnant.js';
import { hashFileSha256 } from './hash-file.js';
import { mediaTypesCompatible, sniffMediaType } from './sniff-media.js';

export interface FileInspection {
  exists: boolean;
  isFile: boolean;
  absolutePath: string;
  isSymlink?: boolean;
  actualSize?: number;
  actualSha256?: string;
  declaredSha256?: string;
  hashMatches?: boolean;
  detectedMediaType?: string;
  mediaTypeMatches?: boolean;
  error?: string;
}

export async function verifyFileHash(path: string, declaredSha256: string): Promise<boolean> {
  const actual = await hashFileSha256(path);
  return actual.toLowerCase() === declaredSha256.toLowerCase();
}

export async function inspectFileOutput(
  output: FileOutput,
  options: { hash?: boolean; sniffMediaType?: boolean } = {},
): Promise<FileInspection> {
  const absolutePath = resolve(output.path);
  const inspection: FileInspection = {
    exists: false,
    isFile: false,
    absolutePath,
    declaredSha256: output.sha256,
  };

  try {
    const link = await lstat(absolutePath);
    inspection.exists = true;
    inspection.isSymlink = link.isSymbolicLink();
    const info = inspection.isSymlink ? await stat(absolutePath) : link;
    inspection.isFile = info.isFile();
    if (!inspection.isFile) return inspection;
    inspection.actualSize = info.size;

    const shouldHash = options.hash !== false && (options.hash === true || Boolean(output.sha256));
    if (shouldHash) {
      inspection.actualSha256 = await hashFileSha256(absolutePath);
      if (output.sha256) {
        inspection.hashMatches = inspection.actualSha256.toLowerCase() === output.sha256.toLowerCase();
      }
    }

    if (options.sniffMediaType !== false) {
      inspection.detectedMediaType = await sniffMediaType(absolutePath);
      inspection.mediaTypeMatches = mediaTypesCompatible(output.mediaType, inspection.detectedMediaType);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    inspection.error = code ?? (err instanceof Error ? err.message : String(err));
    if (code === 'ENOENT') {
      inspection.exists = false;
    }
  }

  return inspection;
}

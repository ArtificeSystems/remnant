import { parseRemnant } from '../parse.js';
import { createRemnant } from '../create.js';
import { canonicalizeRemnant } from '../serialize.js';
import type { Remnant, RemnantOutput } from '../remnant.js';

export const REMNANT_A2A_EXTENSION = 'https://github.com/ArtificeSystems/remnant';
export const REMNANT_A2A_METADATA_KEY = 'com.artifice.remnant';

export interface A2APartBase {
  metadata?: Record<string, unknown>;
}

export interface A2ATextPart extends A2APartBase {
  kind: 'text';
  text: string;
}

export interface A2AFilePart extends A2APartBase {
  kind: 'file';
  file: {
    name?: string;
    mimeType?: string;
    uri?: string;
    bytes?: string;
  };
}

export interface A2ADataPart extends A2APartBase {
  kind: 'data';
  data: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2AFilePart | A2ADataPart;

export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

function toFileUri(path: string): string {
  if (path.startsWith('file:')) return path;
  if (/^[A-Za-z]:[\\/]/.test(path)) return `file:///${path.replace(/\\/g, '/')}`;
  if (path.startsWith('/')) return `file://${path}`;
  return `file://${path}`;
}

function outputToPart(output: RemnantOutput): A2APart {
  if (output.kind === 'text') {
    return {
      kind: 'text',
      text: output.text,
      metadata: output.mediaType || output.name ? { mediaType: output.mediaType, name: output.name } : undefined,
    };
  }
  if (output.kind === 'data') {
    const data =
      output.data && typeof output.data === 'object' && !Array.isArray(output.data)
        ? (output.data as Record<string, unknown>)
        : { value: output.data };
    return { kind: 'data', data };
  }
  if (output.kind === 'file') {
    return {
      kind: 'file',
      file: {
        name: output.name,
        mimeType: output.mediaType,
        uri: toFileUri(output.path),
      },
      metadata: output.sha256 ? { sha256: output.sha256, size: output.size } : undefined,
    };
  }
  return {
    kind: 'file',
    file: {
      name: output.name,
      mimeType: output.mediaType,
      uri: output.uri,
    },
    metadata: output.sha256 ? { sha256: output.sha256 } : undefined,
  };
}

export function toA2AArtifact(remnant: Remnant): A2AArtifact {
  return {
    artifactId: remnant.id,
    name: remnant.goal,
    description: remnant.goal,
    parts: remnant.outputs.map(outputToPart),
    metadata: {
      [REMNANT_A2A_METADATA_KEY]: canonicalizeRemnant(remnant),
    },
    extensions: [REMNANT_A2A_EXTENSION],
  };
}

export function fromA2AArtifact(artifact: A2AArtifact): Remnant {
  const envelope = artifact.metadata?.[REMNANT_A2A_METADATA_KEY];
  if (envelope) return parseRemnant(envelope);
  if (!artifact.parts.length) {
    throw new Error('A2A artifact has no Remnant metadata and no parts');
  }
  return createRemnant({
    id: artifact.artifactId,
    producer: 'a2a',
    goal: artifact.name ?? artifact.description ?? 'Imported A2A artifact',
    outputs: artifact.parts.map(partToOutput),
  });
}

function fromFileUri(uri: string): string {
  if (!uri.startsWith('file:')) return uri;
  try {
    const url = new URL(uri);
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
    return path;
  } catch {
    return uri;
  }
}

function partToOutput(part: A2APart): RemnantOutput {
  if (part.kind === 'text') {
    return { kind: 'text', text: part.text };
  }
  if (part.kind === 'data') {
    return { kind: 'data', data: part.data };
  }
  const file = part.file;
  const uri = file.uri ?? '';
  if (!uri) {
    return {
      kind: 'data',
      name: file.name,
      mediaType: file.mimeType,
      data: file.bytes ? { bytes: file.bytes } : {},
    };
  }
  if (uri.startsWith('file:') || (uri.startsWith('/') && !uri.includes('://'))) {
    return {
      kind: 'file',
      path: uri.startsWith('file:') ? fromFileUri(uri) : uri,
      mediaType: file.mimeType ?? 'application/octet-stream',
      name: file.name,
    };
  }
  return {
    kind: 'reference',
    uri,
    mediaType: file.mimeType,
    name: file.name,
  };
}

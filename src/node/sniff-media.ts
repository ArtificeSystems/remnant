import { open } from 'node:fs/promises';

const MAGICS: Array<{ mediaType: string; test: (buf: Buffer) => boolean }> = [
  { mediaType: 'application/pdf', test: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-' },
  { mediaType: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mediaType: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mediaType: 'application/zip', test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) },
];

export async function sniffMediaType(path: string): Promise<string | undefined> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fh.read(buf, 0, 16, 0);
    const slice = buf.subarray(0, bytesRead);
    for (const magic of MAGICS) {
      if (magic.test(slice)) return magic.mediaType;
    }
    const asText = slice.toString('utf8').trimStart();
    if (asText.startsWith('{') || asText.startsWith('[')) return 'application/json';
    return undefined;
  } finally {
    await fh.close();
  }
}

export function mediaTypesCompatible(declared: string, detected?: string): boolean | undefined {
  if (!detected) return undefined;
  if (declared === detected) return true;
  if (declared === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && detected === 'application/zip') {
    return true;
  }
  if (declared.startsWith('text/') && detected === 'application/json') return false;
  return declared === detected;
}

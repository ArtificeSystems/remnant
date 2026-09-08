import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import type { Remnant } from '../remnant.js';
import { canonicalBytes } from '../serialize.js';

export interface RemnantSignature {
  alg: 'ed25519';
  publicKey: string;
  signature: string;
}

export interface SignedRemnant {
  remnant: Remnant;
  signature: RemnantSignature;
}

export interface SigningKeyPair {
  publicKey: string;
  privateKey: string;
}

function b64(data: Buffer): string {
  return data.toString('base64');
}

function fromB64(value: string | Uint8Array): Buffer {
  return typeof value === 'string' ? Buffer.from(value, 'base64') : Buffer.from(value);
}

function privateKeyObject(key: string | Uint8Array | KeyObject): KeyObject {
  if (typeof key === 'object' && 'type' in key) return key;
  return createPrivateKey({ key: fromB64(key), format: 'der', type: 'pkcs8' });
}

function publicKeyObject(key: string | Uint8Array | KeyObject): KeyObject {
  if (typeof key === 'object' && 'type' in key) return key;
  return createPublicKey({ key: fromB64(key), format: 'der', type: 'spki' });
}

function asBuffer(data: Buffer | string): Buffer {
  return typeof data === 'string' ? Buffer.from(data) : data;
}

export function generateSigningKeyPair(): SigningKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: b64(asBuffer(publicKey.export({ type: 'spki', format: 'der' }))),
    privateKey: b64(asBuffer(privateKey.export({ type: 'pkcs8', format: 'der' }))),
  };
}

/**
 * Sign the canonical Remnant bytes with Ed25519.
 *
 * Payload is UTF-8 `JSON.stringify(canonicalizeRemnant(remnant))` — compact JSON of
 * the Remnant object only. The `SignedRemnant` container and signature fields are
 * not part of the signed bytes.
 *
 * Proves integrity and possession of the key. Does not prove the claims inside are true.
 */
export function signRemnant(remnant: Remnant, privateKey: string | Uint8Array | KeyObject): SignedRemnant {
  const key = privateKeyObject(privateKey);
  const signature = sign(null, Buffer.from(canonicalBytes(remnant)), key);
  const derived = createPublicKey(key).export({ type: 'spki', format: 'der' });
  return {
    remnant,
    signature: {
      alg: 'ed25519',
      publicKey: b64(asBuffer(derived)),
      signature: b64(signature),
    },
  };
}

/**
 * Verify an Ed25519 signature over the canonical Remnant.
 * Success means the bytes match and the key signed them. It does not mean the Remnant is true.
 */
export function verifyRemnantSignature(
  signed: SignedRemnant,
  publicKey: string | Uint8Array | KeyObject = signed.signature.publicKey,
): boolean {
  if (signed.signature.alg !== 'ed25519') return false;
  try {
    return verify(
      null,
      Buffer.from(canonicalBytes(signed.remnant)),
      publicKeyObject(publicKey),
      fromB64(signed.signature.signature),
    );
  } catch {
    return false;
  }
}

import { CONTENT_SIGNING_PUBLIC_KEY_SPKI_B64 } from './signing-key.generated';

/**
 * Detached-signature verification, shared by everything that arrives signed.
 *
 * Extracted from pack.ts when the threat snapshot became the second signed
 * artifact. Both use the same key and the same scheme deliberately: a second
 * crypto path is a second place to get it subtly wrong, and the snapshot is
 * the one artifact that arrives from a network at runtime.
 */

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Convert a DER SEQUENCE{INTEGER r, INTEGER s} into the fixed 64-byte r||s. */
function derToRawEcdsa(der: Uint8Array): Uint8Array {
  let offset = 2; // SEQUENCE tag + length
  if (der[1] !== undefined && der[1] > 0x80) offset = 3;

  const readInt = (): Uint8Array => {
    offset += 1; // INTEGER tag
    const len = der[offset] ?? 0;
    offset += 1;
    let bytes = der.subarray(offset, offset + len);
    offset += len;
    // Strip the leading zero DER adds to keep the value positive.
    while (bytes.length > 32 && bytes[0] === 0) bytes = bytes.subarray(1);
    const padded = new Uint8Array(32);
    padded.set(bytes, 32 - bytes.length);
    return padded;
  };

  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

/**
 * True only when the signature is a valid ECDSA P-256 signature over exactly
 * these bytes, made by the key generated into this bundle.
 *
 * Throws nothing: a malformed signature is an unverified one, which is the
 * same outcome as a wrong one and is handled the same way by both callers.
 */
export async function verifyDetachedSignature(
  bytes: ArrayBuffer,
  signatureB64: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      b64ToBytes(CONTENT_SIGNING_PUBLIC_KEY_SPKI_B64),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    // Node signs DER-encoded ECDSA; WebCrypto expects the raw r||s pair.
    const raw = derToRawEcdsa(b64ToBytes(signatureB64.trim()));
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, bytes);
  } catch {
    return false;
  }
}

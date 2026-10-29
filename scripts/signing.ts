import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';

/**
 * The signing key, shared by the content pack and the threat snapshots.
 *
 * Extracted from build-content-pack.ts when the snapshots became the second
 * signed artifact. Both sign with the same key because the bundle carries one
 * public key as its trust root; a second key would need a second place to put
 * it and a second way to get that wrong.
 */

export function loadOrCreateKeyPair(root: string): {
  privateKey: string;
  publicKeyDer: Buffer;
} {
  const fromEnv = process.env['CONTENT_SIGNING_KEY'];
  if (fromEnv) {
    return {
      privateKey: fromEnv,
      publicKeyDer: createPublicKey(fromEnv).export({ type: 'spki', format: 'der' }) as Buffer,
    };
  }

  const keyDir = join(root, '.dev-keys');
  const keyPath = join(keyDir, 'content-signing.pem');

  if (!existsSync(keyPath)) {
    mkdirSync(keyDir, { recursive: true });
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), {
      mode: 0o600,
    });
    console.log('Generated a development signing key at .dev-keys/ (gitignored).');
  }

  const pem = readFileSync(keyPath, 'utf8');
  return {
    privateKey: pem,
    publicKeyDer: createPublicKey(pem).export({ type: 'spki', format: 'der' }) as Buffer,
  };
}

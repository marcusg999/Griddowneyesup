import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyDetachedSignature } from '@/content/signature';

/**
 * The threat snapshot is the only artifact that arrives from a network at
 * runtime, which makes it the only place an attacker between the user and the
 * CDN could inject a signal. "A flash flood warning is in effect" is a
 * sentence that moves people, so the question of who is allowed to say it is a
 * security question, not a formatting one.
 *
 * These tests sign with the real development key and run the real client
 * verifier against it. Nothing is mocked: a stub here would prove only that
 * the stub works.
 *
 * Lives with the app tests rather than the build-time ones because the subject
 * is the client verifier, which uses DOM crypto. node:crypto appears here only
 * to mint the fixtures an attacker would be trying to forge.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const KEY_PATH = join(ROOT, '.dev-keys', 'content-signing.pem');

const sign = (body: Buffer): string =>
  createSign('SHA256').update(body).end().sign(readFileSync(KEY_PATH, 'utf8')).toString('base64');

const bytes = (s: string): ArrayBuffer => {
  const buffer = Buffer.from(s);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

// The key and the generated module are build products. Skip rather than fail
// when the suite runs before a build has ever happened.
const ready = existsSync(KEY_PATH) && existsSync(join(ROOT, 'src/content/signing-key.generated.ts'));

describe.skipIf(!ready)('threat snapshot signatures', () => {
  const digest = JSON.stringify({
    version: 1,
    provenance: 'live',
    region: '06075',
    regionLabel: 'San Francisco County, CA',
    publishedAt: '2026-06-01T12:00:00.000Z',
    signals: [],
  });

  it('accepts a digest signed by the key in the bundle', async () => {
    const body = Buffer.from(digest);
    expect(await verifyDetachedSignature(bytes(digest), sign(body))).toBe(true);
  });

  it('rejects a digest whose body was altered after signing', async () => {
    // The attack this exists to stop: a valid signature kept, the signals
    // swapped underneath it.
    const signature = sign(Buffer.from(digest));
    const tampered = digest.replace('"signals":[]', '"signals":[{"level":"active"}]');
    expect(tampered).not.toBe(digest);
    expect(await verifyDetachedSignature(bytes(tampered), signature)).toBe(false);
  });

  it('rejects a digest signed by a different key', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const foreign = createSign('SHA256')
      .update(Buffer.from(digest))
      .end()
      .sign(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
      .toString('base64');

    expect(await verifyDetachedSignature(bytes(digest), foreign)).toBe(false);
  });

  it('rejects an empty or malformed signature instead of throwing', async () => {
    // The caller treats false as "keep what you have". Throwing here would
    // put an unhandled rejection on a background errand instead.
    for (const bad of ['', 'not base64 at all', 'AAAA']) {
      await expect(verifyDetachedSignature(bytes(digest), bad)).resolves.toBe(false);
    }
  });

  it('verifies the digest the build actually published', async () => {
    const published = join(ROOT, 'public', 'snapshot', 'default.json');
    if (!existsSync(published)) return;

    const body = readFileSync(published);
    const signature = readFileSync(`${published}.sig`, 'utf8');
    const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);

    expect(await verifyDetachedSignature(arrayBuffer as ArrayBuffer, signature)).toBe(true);

    // And that what shipped is marked as sample, not presented as real.
    expect(JSON.parse(body.toString()).provenance).toBe('sample');
  });
});

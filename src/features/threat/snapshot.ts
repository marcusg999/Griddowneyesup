import { store } from '@/db';
import { verifyDetachedSignature } from '@/content/signature';
import type { ThreatSnapshot } from './types';

/**
 * Reading the threat digest. ARCHITECTURE §0, D11.
 *
 * This is the only part of the app that wants a network, which makes it the
 * only part that could break the premise. So the shape is deliberate:
 *
 *   read from IndexedDB  ->  render  ->  (maybe) refresh in the background
 *
 * The render never waits. `storedSnapshot()` is the render path and touches
 * nothing but local storage. `refreshSnapshot()` is a background errand whose
 * failure is normal and silent — a digest that could not be fetched is not an
 * error state, it is Tuesday with the radio off.
 *
 * The snapshot is also the one artifact that arrives from a network at
 * runtime, so it is signed and verified with the same key as the content pack
 * before it is trusted or written. An unverified snapshot is discarded and the
 * stored one is left alone: a bad update must never cost the user the good data
 * they already had.
 */

const SNAPSHOT_BASE = `${import.meta.env.BASE_URL}snapshot`.replace(/\/{2,}/g, '/');

/**
 * Hard ceiling on the background fetch. The service worker's NetworkFirst rule
 * uses the same figure; this is the belt to that braces, for the case where no
 * service worker is in control yet.
 */
const FETCH_TIMEOUT_MS = 3_000;

/** The render path. Local only — no network, no awaiting anything remote. */
export async function storedSnapshot(region: string): Promise<ThreatSnapshot | undefined> {
  try {
    return await store.threat.get(region);
  } catch {
    // A read failure here must not take the page down with it. The surface
    // renders its quiet state and the user loses nothing they had.
    return undefined;
  }
}

async function fetchWithTimeout(url: string): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? response : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Background errand: fetch, verify, store. Returns the snapshot when it
 * actually replaced what was there, and undefined in every other case —
 * offline, timed out, unsigned, tampered with, or simply not newer.
 *
 * Never throws. Nothing calling this should have to care whether it worked.
 */
export async function refreshSnapshot(region: string): Promise<ThreatSnapshot | undefined> {
  const [digest, signature] = await Promise.all([
    fetchWithTimeout(`${SNAPSHOT_BASE}/${region}.json`),
    fetchWithTimeout(`${SNAPSHOT_BASE}/${region}.json.sig`),
  ]);
  if (!digest || !signature) return undefined;

  const bytes = await digest.arrayBuffer().catch(() => undefined);
  const signatureB64 = await signature.text().catch(() => undefined);
  if (!bytes || !signatureB64) return undefined;

  if (!(await verifyDetachedSignature(bytes, signatureB64))) {
    // Deliberately loud in the console and silent in the interface: the user
    // cannot act on this, and the stored digest is still good.
    console.error('Threat snapshot signature did not verify. Keeping the stored digest.');
    return undefined;
  }

  let parsed: ThreatSnapshot;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as ThreatSnapshot;
  } catch {
    return undefined;
  }

  if (parsed.version !== 1 || parsed.region !== region || !Array.isArray(parsed.signals)) {
    console.error('Threat snapshot failed its shape check. Keeping the stored digest.');
    return undefined;
  }

  // Signed, well-formed, and for the region asked for — but still not worth
  // writing if it is older than what is on disk. Snapshots can be served from
  // a CDN edge that is behind.
  const existing = await storedSnapshot(region);
  if (existing && Date.parse(existing.publishedAt) >= Date.parse(parsed.publishedAt)) {
    return undefined;
  }

  await store.threat.put(parsed);
  return parsed;
}

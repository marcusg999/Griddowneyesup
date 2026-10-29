import { store } from '@/db';
import { CONTENT_SIGNING_PUBLIC_KEY_SPKI_B64 } from './signing-key.generated';
import type {
  CatalogItem,
  ContentPackManifest,
  DependentOverlay,
  HazardOverlay,
  KitDefinition,
  Skill,
} from './types';

/**
 * Content pack loading and verification. ARCHITECTURE §6.
 *
 * The pack ships with the app and is precached by the service worker, so this
 * runs against the local cache rather than the network in every normal case.
 *
 * Verification is strict and the failure mode is deliberate: an unverifiable
 * pack is rejected and the previously installed pack stays active. A failed
 * content update must never degrade a working install — the user may be
 * standing in the dark.
 */

const PACK_BASE = '/content/en-US';
const META_INSTALLED_VERSION = 'contentPackVersion';

export interface LoadedPack {
  readonly manifest: ContentPackManifest;
  readonly skills: readonly Skill[];
  readonly items: readonly CatalogItem[];
  readonly kits: readonly KitDefinition[];
  readonly hazardOverlays: readonly HazardOverlay[];
  readonly dependentOverlays: readonly DependentOverlay[];
  readonly searchIndex: unknown;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyManifestSignature(
  manifestBytes: ArrayBuffer,
  signatureB64: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'spki',
    b64ToBytes(CONTENT_SIGNING_PUBLIC_KEY_SPKI_B64),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  // Node signs DER-encoded ECDSA; WebCrypto expects the raw r||s pair.
  const der = b64ToBytes(signatureB64);
  const raw = derToRawEcdsa(der);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, raw, manifestBytes);
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

async function fetchArtifact(path: string): Promise<ArrayBuffer> {
  const response = await fetch(`${PACK_BASE}/${path}`);
  if (!response.ok) throw new Error(`content artifact ${path}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

const decode = <T>(bytes: ArrayBuffer): T =>
  JSON.parse(new TextDecoder().decode(bytes)) as T;

/**
 * Fetch, verify and install the pack into IndexedDB.
 *
 * Returns false when the installed pack is already current, or when
 * verification failed and the previous pack was left in place.
 */
export async function installContentPack(): Promise<boolean> {
  try {
    const manifestBytes = await fetchArtifact('index.json');
    const signature = new TextDecoder().decode(await fetchArtifact('index.json.sig'));

    if (!(await verifyManifestSignature(manifestBytes, signature))) {
      console.error('Content pack signature did not verify. Keeping the installed pack.');
      return false;
    }

    const manifest = decode<ContentPackManifest>(manifestBytes);
    const installed = await store.meta.get<string>(META_INSTALLED_VERSION);
    if (installed === manifest.version) return false;

    // Fetch and hash-check every artifact BEFORE writing any of them, so a
    // partial update can never leave a half-installed library.
    const staged: Array<{ name: string; value: unknown }> = [];
    for (const entry of manifest.entries) {
      const bytes = await fetchArtifact(entry.path);
      const actual = await sha256Hex(bytes);
      if (actual !== entry.sha256) {
        console.error(`Content artifact ${entry.path} failed its hash check. Keeping the installed pack.`);
        return false;
      }
      staged.push({ name: entry.path.split('.')[0] ?? entry.path, value: decode(bytes) });
    }

    for (const { name, value } of staged) await store.content.put(name, value);
    await store.content.put('manifest', manifest);
    await store.meta.put(META_INSTALLED_VERSION, manifest.version);
    return true;
  } catch (error) {
    // Offline, or the network produced nonsense. Either way the installed pack
    // is what the user has and it keeps working. This is the expected path on
    // most launches, not an error condition.
    console.info('Content pack not refreshed; using the installed copy.', error);
    return false;
  }
}

/** Read the installed pack out of IndexedDB. Never touches the network. */
export async function readInstalledPack(): Promise<LoadedPack | undefined> {
  const manifest = await store.content.get<ContentPackManifest>('manifest');
  if (!manifest) return undefined;

  const [skills, items, kits, overlays, searchIndex] = await Promise.all([
    store.content.get<Skill[]>('skills'),
    store.content.get<CatalogItem[]>('items'),
    store.content.get<KitDefinition[]>('kits'),
    store.content.get<{ hazard: HazardOverlay[]; dependent: DependentOverlay[] }>('overlays'),
    store.content.get<unknown>('search'),
  ]);

  if (!skills || !items || !kits || !overlays) return undefined;

  return {
    manifest,
    skills,
    items,
    kits,
    hazardOverlays: overlays.hazard,
    dependentOverlays: overlays.dependent,
    searchIndex,
  };
}

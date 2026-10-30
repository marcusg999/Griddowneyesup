import { store } from '@/db';
import { verifyDetachedSignature } from './signature';
import { recordSync } from '@/state/sync';
import type {
  CatalogItem,
  ContentPackManifest,
  DependentOverlay,
  HazardOverlay,
  Indicator,
  KitDefinition,
  Offer,
  PostureNote,
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

/**
 * Resolved against the deployment base so the pack is found whether the app
 * is served from a domain root or from a project subpath.
 */
const PACK_BASE = `${import.meta.env.BASE_URL}content/en-US`.replace(/\/{2,}/g, '/');
const META_INSTALLED_VERSION = 'contentPackVersion';

export interface LoadedPack {
  readonly manifest: ContentPackManifest;
  readonly skills: readonly Skill[];
  readonly items: readonly CatalogItem[];
  readonly kits: readonly KitDefinition[];
  readonly hazardOverlays: readonly HazardOverlay[];
  readonly dependentOverlays: readonly DependentOverlay[];
  readonly posture: readonly PostureNote[];
  readonly indicators: readonly Indicator[];
  readonly offers: readonly Offer[];
  readonly searchIndex: unknown;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

    if (!(await verifyDetachedSignature(manifestBytes, signature))) {
      console.error('Content pack signature did not verify. Keeping the installed pack.');
      return false;
    }

    // The manifest was fetched and verified, so this device has a route out.
    // That is what "last synced" means, whether or not the pack moved.
    await recordSync();

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
    // Deliberate, and on the expected path rather than a failure: this is how
    // "why did my pack not update" gets answered without a debugger.
    // eslint-disable-next-line no-console
    console.info('Content pack not refreshed; using the installed copy.', error);
    return false;
  }
}

/** Read the installed pack out of IndexedDB. Never touches the network. */
export async function readInstalledPack(): Promise<LoadedPack | undefined> {
  const manifest = await store.content.get<ContentPackManifest>('manifest');
  if (!manifest) return undefined;

  const [skills, items, kits, overlays, posture, indicators, offers, searchIndex] =
    await Promise.all([
    store.content.get<Skill[]>('skills'),
    store.content.get<CatalogItem[]>('items'),
    store.content.get<KitDefinition[]>('kits'),
    store.content.get<{ hazard: HazardOverlay[]; dependent: DependentOverlay[] }>('overlays'),
    store.content.get<PostureNote[]>('posture'),
    store.content.get<Indicator[]>('indicators'),
    store.content.get<Offer[]>('offers'),
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
    posture: posture ?? [],
    indicators: indicators ?? [],
    offers: offers ?? [],
    searchIndex,
  };
}

import { createSign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOrCreateKeyPair } from './signing';
import {
  snapshotSchema,
  type Brief,
  type Posture,
  type Signal,
  type Snapshot,
} from './ingest/schema';
import { apiKey as airNowKey, collectAirNow } from './ingest/sources/airnow';
import { collectEnso } from './ingest/sources/enso';
import { collectGdacs } from './ingest/sources/gdacs';
import { collectGdelt } from './ingest/sources/gdelt';
import { collectNws } from './ingest/sources/nws';
import { collectOpenFema } from './ingest/sources/openfema';
import { collectReliefWeb } from './ingest/sources/reliefweb';
import { collectSwpc } from './ingest/sources/swpc';
import { collectUsgs } from './ingest/sources/usgs';
import type { RegionSpec, SourceResult } from './ingest/types';

/**
 * The ingester. Step 7's other half.
 *
 * Runs on a schedule in CI, fetches the live sources, and publishes a signed
 * digest per region to the same Pages site the app is served from. No separate
 * infrastructure: the runner has a network and the deploy pipeline already
 * exists, which is the whole reason this is a file rather than a proposal.
 *
 * Three properties matter more than coverage here.
 *
 *   FAIL SOFT PER SOURCE. A source that is down, slow, or has quietly changed
 *   shape is recorded as unreachable and the digest publishes without it. Six
 *   sources where one is broken is a true digest with a gap, and the
 *   confidence line already knows how to say so. Refusing to publish would
 *   turn one API's bad afternoon into no digest at all.
 *
 *   VALIDATE BEFORE SIGNING. Every digest is checked against the schema before
 *   it is written. A signature is a statement that we stand behind the bytes;
 *   signing something malformed is the one failure the client cannot defend
 *   against, because verification would pass.
 *
 *   NEVER CLAIM LIVE WITHOUT LIVE DATA. If no source parsed, nothing is
 *   written at all, and the previously published digest stays. An empty digest
 *   marked `live` would read as "we checked, all quiet" — a far worse lie than
 *   a stale one, because the reader cannot tell.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'snapshot');

/**
 * The regions published. `default` is the national digest for a household that
 * has not told us a county; the rest slice the state-level sources.
 */
const REGIONS: readonly RegionSpec[] = [
  { region: 'default', label: 'your area' },
  { region: '06075', label: 'San Francisco County, CA', state: 'CA', zip: '94102' },
];

/** Run a source, and turn any failure into a named gap rather than a crash. */
async function attempt(
  id: string,
  run: () => Promise<SourceResult>,
): Promise<{ id: string; result?: SourceResult; error?: string }> {
  try {
    return { id, result: await run() };
  } catch (error) {
    return { id, error: error instanceof Error ? error.message : String(error) };
  }
}

const SIGNAL_SOURCES = new Set(['nws', 'usgs', 'wildfire-air', 'openfema', 'swpc']);

async function buildRegion(
  spec: RegionSpec,
  globalBrief: readonly Brief[],
  globalPosture: readonly Posture[],
  globalSignals: readonly Signal[],
  globalUnreachable: readonly string[],
  globalAttempted: readonly string[],
  now: Date,
): Promise<Snapshot | undefined> {
  const signals: Signal[] = [...globalSignals];
  const unreachable: string[] = [...globalUnreachable];
  // Every signal source TRIED for this region, which is the denominator the
  // confidence line divides by. A source we never attempted — AirNow with no
  // key, a state-sliced source for a region with no state — is not a gap, and
  // counting it as one made the county's picture look worse than it was.
  const attempted = new Set<string>(globalAttempted);

  // State-sliced sources. A region with no state gets the national picture
  // only, rather than a guess at which state it meant.
  const local: Array<{ id: string; run: () => Promise<SourceResult> }> = [];
  if (spec.state) {
    const state = spec.state;
    local.push({ id: 'nws', run: () => collectNws(state, now) });
    local.push({ id: 'openfema', run: () => collectOpenFema(state, now) });
  }
  // AirNow needs both a ZIP and a key. Without either it is not attempted, so
  // it never appears as an unreachable source the reader cannot act on.
  if (spec.zip && airNowKey()) {
    const zip = spec.zip;
    local.push({ id: 'wildfire-air', run: () => collectAirNow(zip, spec.label) });
  } else if (spec.zip) {
    console.warn(`  ${spec.region}: AIRNOW_API_KEY not set, air quality not attempted`);
  }

  if (local.length > 0) {
    const outcomes = await Promise.all(local.map(({ id, run }) => attempt(id, run)));
    for (const outcome of outcomes) {
      attempted.add(outcome.id);
      if (outcome.result?.signal) signals.push(outcome.result.signal);
      else {
        unreachable.push(outcome.id);
        console.warn(`  ${spec.region}: ${outcome.id} unreachable — ${outcome.error ?? 'no data'}`);
      }
    }
  }

  if (signals.length === 0) {
    console.warn(`  ${spec.region}: no source reported, leaving the published digest alone`);
    return undefined;
  }

  const snapshot: Snapshot = {
    version: 1,
    provenance: 'live',
    region: spec.region,
    regionLabel: spec.label,
    publishedAt: now.toISOString(),
    signals,
    ...(globalBrief.length > 0 ? { brief: [...globalBrief] } : {}),
    ...(globalPosture.length > 0 ? { posture: [...globalPosture] } : {}),
    ...(unreachable.length > 0 ? { unreachable } : {}),
    attempted: [...attempted].filter((id) => SIGNAL_SOURCES.has(id)) as Snapshot['attempted'],
  };

  const checked = snapshotSchema.safeParse(snapshot);
  if (!checked.success) {
    console.error(
      `  ${spec.region}: failed its own schema, not publishing — ${checked.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
    return undefined;
  }

  return checked.data;
}

async function main(): Promise<void> {
  const now = new Date();
  mkdirSync(OUT_DIR, { recursive: true });

  // Sources that are the same everywhere, fetched once.
  console.log('Fetching global sources…');
  const globals = await Promise.all([
    attempt('usgs', () => collectUsgs(now)),
    attempt('swpc', () => collectSwpc(now)),
    attempt('reliefweb', () => collectReliefWeb()),
    // Unrest and conflict. ReliefWeb carried these until its v1 was retired
    // and its v2 started refusing unregistered callers; GDELT fills the gap
    // behind a publisher allow-list. Both are kept: if a ReliefWeb appname is
    // ever registered it comes back on its own, and the two overlapping is
    // better than the category going dark again.
    attempt('gdelt', () => collectGdelt()),
    // Disasters and severe weather worldwide. Until this, every disaster
    // source here stopped at the US border except USGS, which left the feed
    // claiming to be about the world while reporting one country's weather.
    attempt('gdacs', () => collectGdacs()),
    // Not an alert: a correction. The pack ships a posture note on the ENSO
    // state, and a baked-in claim about the climate is wrong four months later
    // on a phone nobody opened. This recomputes it from NOAA's index.
    attempt('enso', () => collectEnso(now)),
  ]);

  const globalSignals: Signal[] = [];
  const globalBrief: Brief[] = [];
  const globalPosture: Posture[] = [];
  const globalUnreachable: string[] = [];
  // Signal sources tried everywhere, so each region's denominator starts from
  // the same base. USGS and SWPC are global; the rest are per region.
  const globalAttempted: string[] = [];

  for (const outcome of globals) {
    if (SIGNAL_SOURCES.has(outcome.id)) globalAttempted.push(outcome.id);
    if (!outcome.result) {
      globalUnreachable.push(outcome.id);
      console.warn(`  ${outcome.id} unreachable — ${outcome.error ?? 'no data'}`);
      continue;
    }
    if (outcome.result.signal) globalSignals.push(outcome.result.signal);
    if (outcome.result.brief) globalBrief.push(...outcome.result.brief);
    if (outcome.result.posture) globalPosture.push(...outcome.result.posture);
    console.log(
      `  ${outcome.id}: ${outcome.result.signal ? '1 signal' : 'no signal'}, ` +
        `${outcome.result.brief?.length ?? 0} brief items, ` +
        `${outcome.result.posture?.length ?? 0} posture notes`,
    );
  }

  if (globalSignals.length === 0 && globalBrief.length === 0 && globalPosture.length === 0) {
    // Everything failed. Exit 0 rather than 1: a scheduled job that goes red
    // because an upstream API had an outage trains people to ignore it, and
    // the published digest is still there and still correct.
    console.warn('No global source reported. Leaving every published digest alone.');
    return;
  }

  const { privateKey } = loadOrCreateKeyPair(ROOT);
  const published: string[] = [];

  for (const spec of REGIONS) {
    const snapshot = await buildRegion(
      spec,
      globalBrief,
      globalPosture,
      globalSignals,
      globalUnreachable,
      globalAttempted,
      now,
    );
    if (!snapshot) continue;

    const body = Buffer.from(JSON.stringify(snapshot));
    writeFileSync(join(OUT_DIR, `${spec.region}.json`), body);
    writeFileSync(
      join(OUT_DIR, `${spec.region}.json.sig`),
      createSign('SHA256').update(body).end().sign(privateKey).toString('base64'),
    );
    published.push(
      `${spec.region} (${snapshot.signals.length}/${snapshot.attempted?.length ?? 0} signals, ` +
        `${snapshot.brief?.length ?? 0} brief, ${snapshot.posture?.length ?? 0} posture)`,
    );
  }

  if (published.length === 0) {
    console.warn('Nothing published. The previous digests stand.');
    return;
  }

  console.log(`Live digests published and signed: ${published.join(', ')}`);
}

await main();

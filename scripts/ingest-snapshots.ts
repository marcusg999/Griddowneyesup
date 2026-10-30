import { createSign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOrCreateKeyPair } from './signing';
import { snapshotSchema, type Brief, type Signal, type Snapshot } from './ingest/schema';
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
  { region: '06075', label: 'San Francisco County, CA', state: 'CA' },
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

async function buildRegion(
  spec: RegionSpec,
  globalBrief: readonly Brief[],
  globalSignals: readonly Signal[],
  globalUnreachable: readonly string[],
  now: Date,
): Promise<Snapshot | undefined> {
  const signals: Signal[] = [...globalSignals];
  const unreachable: string[] = [...globalUnreachable];

  // State-sliced sources. A region with no state gets the national picture
  // only, rather than a guess at which state it meant.
  if (spec.state) {
    const outcomes = await Promise.all([
      attempt('nws', () => collectNws(spec.state as string, now)),
      attempt('openfema', () => collectOpenFema(spec.state as string, now)),
    ]);
    for (const outcome of outcomes) {
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
    ...(unreachable.length > 0 ? { unreachable } : {}),
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
  ]);

  const globalSignals: Signal[] = [];
  const globalBrief: Brief[] = [];
  const globalUnreachable: string[] = [];

  for (const outcome of globals) {
    if (!outcome.result) {
      globalUnreachable.push(outcome.id);
      console.warn(`  ${outcome.id} unreachable — ${outcome.error ?? 'no data'}`);
      continue;
    }
    if (outcome.result.signal) globalSignals.push(outcome.result.signal);
    if (outcome.result.brief) globalBrief.push(...outcome.result.brief);
    console.log(
      `  ${outcome.id}: ${outcome.result.signal ? '1 signal' : 'no signal'}, ${outcome.result.brief?.length ?? 0} brief items`,
    );
  }

  if (globalSignals.length === 0 && globalBrief.length === 0) {
    // Everything failed. Exit 0 rather than 1: a scheduled job that goes red
    // because an upstream API had an outage trains people to ignore it, and
    // the published digest is still there and still correct.
    console.warn('No global source reported. Leaving every published digest alone.');
    return;
  }

  const { privateKey } = loadOrCreateKeyPair(ROOT);
  const published: string[] = [];

  for (const spec of REGIONS) {
    const snapshot = await buildRegion(spec, globalBrief, globalSignals, globalUnreachable, now);
    if (!snapshot) continue;

    const body = Buffer.from(JSON.stringify(snapshot));
    writeFileSync(join(OUT_DIR, `${spec.region}.json`), body);
    writeFileSync(
      join(OUT_DIR, `${spec.region}.json.sig`),
      createSign('SHA256').update(body).end().sign(privateKey).toString('base64'),
    );
    published.push(
      `${spec.region} (${snapshot.signals.length} signals, ${snapshot.brief?.length ?? 0} brief)`,
    );
  }

  if (published.length === 0) {
    console.warn('Nothing published. The previous digests stand.');
    return;
  }

  console.log(`Live digests published and signed: ${published.join(', ')}`);
}

await main();

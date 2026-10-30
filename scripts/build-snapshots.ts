import { createSign } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOrCreateKeyPair } from './signing';

/**
 * Publishes the threat snapshots.
 *
 * This is the stand-in for step 7's ingestion pipeline, which does not exist
 * yet. It takes the sample digests in content/snapshots/ and publishes them
 * signed, in exactly the shape and at exactly the paths a real pipeline would,
 * so the whole client half — fetch, timeout, verify, store, render, band — is
 * exercised against the real thing rather than against a mock.
 *
 * Every digest it writes is marked `provenance: "sample"`, which the interface
 * renders as an unmissable notice and which bars it from suggesting a
 * readiness state. Replacing this script with a real ingester is the only
 * change needed to make the feed live; nothing downstream knows the difference
 * except that flag.
 *
 * Signal ages are relative in the fixture and absolute in the output, stamped
 * at build time. A committed fixture with fixed timestamps would read as
 * permanently stale, which would make the staleness rules untestable in the
 * app and the demo misleading.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = join(ROOT, 'content', 'snapshots');
const OUT_DIR = join(ROOT, 'public', 'snapshot');

interface FixtureSignal {
  readonly source: string;
  readonly sourceName: string;
  readonly level: string;
  readonly ageHours: number;
  readonly headline: string;
  readonly meansForYou: string;
  readonly url: string;
}

interface Fixture {
  readonly region: string;
  readonly regionLabel: string;
  readonly note: string;
  readonly signals: readonly FixtureSignal[];
  readonly unreachable?: readonly string[];
}

const REQUIRED_SIGNAL_FIELDS: Array<keyof FixtureSignal> = [
  'source',
  'sourceName',
  'level',
  'headline',
  'meansForYou',
  'url',
];

function main(): void {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const { privateKey } = loadOrCreateKeyPair(ROOT);
  const now = Date.now();
  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
  const published: string[] = [];

  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')) as Fixture;

    // CONTENT_POLICY §4.4 makes source, link, timestamp and the "what this
    // means for you" line mandatory on every item. Fail the build rather than
    // publish a signal missing one.
    for (const signal of fixture.signals) {
      for (const field of REQUIRED_SIGNAL_FIELDS) {
        if (!signal[field]) {
          throw new Error(`${file}: signal "${signal.source}" is missing ${field} (§4.4)`);
        }
      }
      if (typeof signal.ageHours !== 'number') {
        throw new Error(`${file}: signal "${signal.source}" needs a numeric ageHours`);
      }
    }

    // Fail closed on world context. The schema allows a digest to carry
    // posture notes and economic indicators so the real pipeline can correct
    // them, but a SAMPLE digest doing it would be fabricating claims about
    // governments and markets, wearing an epistemic status that means
    // "traceable to a published source" (D21). The client ignores them from a
    // sample digest; this stops one being published in the first place.
    const fixtureAny = fixture as unknown as Record<string, unknown>;
    for (const field of ['posture', 'indicators']) {
      if (fixtureAny[field] !== undefined) {
        throw new Error(
          `${file}: a sample digest may not carry ${field} — see D21. World context ` +
            `belongs to the content pack until the real ingester publishes it.`,
        );
      }
    }

    const snapshot = {
      version: 1 as const,
      provenance: 'sample' as const,
      region: fixture.region,
      regionLabel: fixture.regionLabel,
      publishedAt: new Date(now).toISOString(),
      signals: fixture.signals.map((s) => ({
        source: s.source,
        sourceName: s.sourceName,
        level: s.level,
        headline: s.headline,
        meansForYou: s.meansForYou,
        url: s.url,
        observedAt: new Date(now - s.ageHours * 3_600_000).toISOString(),
      })),
      ...(fixture.unreachable ? { unreachable: fixture.unreachable } : {}),
    };

    const body = Buffer.from(JSON.stringify(snapshot));
    writeFileSync(join(OUT_DIR, `${fixture.region}.json`), body);

    const signature = createSign('SHA256').update(body).end().sign(privateKey);
    writeFileSync(join(OUT_DIR, `${fixture.region}.json.sig`), signature.toString('base64'));

    published.push(`${fixture.region} (${fixture.signals.length} signals)`);
  }

  console.log(`Snapshots published, signed, marked sample: ${published.join(', ')}`);
}

main();

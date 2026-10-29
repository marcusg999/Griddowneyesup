/**
 * Content pack builder. ARCHITECTURE §6.
 *
 * Produces the signed, versioned, content-addressed artifacts the service
 * worker precaches. This is the thing that makes airplane mode work, so it runs
 * on every build and refuses to emit anything that does not validate.
 *
 * Signing model: the verification public key is generated into the app bundle
 * (`src/content/signing-key.generated.ts`), not served alongside the pack. The
 * bundle is the trust root; a signature that travelled with its own key would
 * verify anything an attacker chose to substitute.
 */
import {
  createHash,
  createPublicKey,
  createSign,
  generateKeyPairSync,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { validateContent } from './validate-content.js';

const LOCALE = 'en-US';
const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', LOCALE);
const OUT_DIR = join(ROOT, 'public', 'content', LOCALE);
const KEY_DIR = join(ROOT, '.dev-keys');
const KEY_PATH = join(KEY_DIR, 'content-signing.pem');
const GENERATED_KEY_TS = join(ROOT, 'src', 'content', 'signing-key.generated.ts');

// ---------------------------------------------------------------------------
// Signing keys
// ---------------------------------------------------------------------------

/**
 * Production signs with CONTENT_SIGNING_KEY from the environment. Development
 * generates a local keypair on first build, gitignored, so a fresh clone works
 * and the verification path is genuinely exercised in tests rather than
 * stubbed.
 */
function loadOrCreateKeyPair(): { privateKey: string; publicKeyDer: Buffer } {
  const fromEnv = process.env['CONTENT_SIGNING_KEY'];
  if (fromEnv) {
    return {
      privateKey: fromEnv,
      publicKeyDer: createPublicKey(fromEnv).export({ type: 'spki', format: 'der' }),
    };
  }

  if (!existsSync(KEY_PATH)) {
    mkdirSync(KEY_DIR, { recursive: true });
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    writeFileSync(
      KEY_PATH,
      privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      { mode: 0o600 },
    );
    console.log('Generated a development signing key at .dev-keys/ (gitignored).');
  }

  const pem = readFileSync(KEY_PATH, 'utf8');
  return {
    privateKey: pem,
    publicKeyDer: createPublicKey(pem).export({ type: 'spki', format: 'der' }),
  };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const sha256 = (buf: Buffer | string): string =>
  createHash('sha256').update(buf).digest('hex');

interface Entry {
  path: string;
  sha256: string;
  bytes: number;
}

function emit(name: string, data: unknown, entries: Entry[]): void {
  const body = Buffer.from(JSON.stringify(data));
  const hash = sha256(body);
  // Content-addressed: immutable, so it caches forever once fetched.
  const filename = `${name}.${hash.slice(0, 12)}.json`;
  writeFileSync(join(OUT_DIR, filename), body);
  entries.push({ path: filename, sha256: hash, bytes: body.byteLength });
}

function build(): void {
  const { problems, warnings } = validateContent();
  for (const w of warnings) console.warn(`  warn  ${w.where}: ${w.message}`);
  if (problems.length > 0) {
    console.error(`\nRefusing to build a content pack with ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  error  ${p.where}: ${p.message}`);
    process.exit(1);
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const read = (f: string) => JSON.parse(readFileSync(join(CONTENT_DIR, f), 'utf8'));
  const skills = read('skills.json');
  const items = read('items.json');
  const kits = read('kits.json');
  const overlays = read('overlays.json');
  const posture = read('posture.json');
  const indicators = read('indicators.json');
  const offers = read('offers.json');

  const entries: Entry[] = [];
  emit('skills', skills, entries);
  emit('items', items, entries);
  emit('kits', kits, entries);
  emit('overlays', overlays, entries);
  emit('posture', posture, entries);
  emit('indicators', indicators, entries);
  // Separate artifact on purpose: commerce data never travels with the
  // content it might otherwise be thought to influence.
  emit('offers', offers, entries);

  // Full-text index is built here, not on device. Building an index on a
  // five-year-old Android at first launch is the wrong place to spend the
  // user's battery (ARCHITECTURE §6).
  const index = new MiniSearch({
    fields: ['title', 'summary', 'category', 'stepText', 'doesNotDoText'],
    storeFields: ['title', 'category', 'riskTier', 'summary', 'timeRequiredMin'],
    idField: 'id',
  });
  index.addAll(
    skills.map((s: Record<string, unknown>) => ({
      id: s['id'],
      title: s['title'],
      summary: s['summary'],
      category: s['category'],
      riskTier: s['riskTier'],
      timeRequiredMin: s['timeRequiredMin'],
      stepText: (s['steps'] as { text: string }[]).map((x) => x.text).join(' '),
      doesNotDoText: (s['doesNotDo'] as string[]).join(' '),
    })),
  );
  emit('search', index.toJSON(), entries);

  const manifest = {
    version: `${new Date().toISOString().slice(0, 10)}.${sha256(JSON.stringify(entries)).slice(0, 8)}`,
    locale: LOCALE,
    builtAt: new Date().toISOString(),
    entries,
    counts: { skills: skills.length, items: items.length, kits: kits.length },
  };

  const manifestBody = Buffer.from(JSON.stringify(manifest));
  writeFileSync(join(OUT_DIR, 'index.json'), manifestBody);

  // Detached signature over the manifest. The manifest carries every artifact
  // hash, so one signature covers the whole pack.
  const { privateKey, publicKeyDer } = loadOrCreateKeyPair();
  const signature = createSign('SHA256').update(manifestBody).end().sign(privateKey);
  writeFileSync(join(OUT_DIR, 'index.json.sig'), signature.toString('base64'));

  writeFileSync(
    GENERATED_KEY_TS,
    `// GENERATED by scripts/build-content-pack.ts — do not edit.
//
// SPKI public key (base64 DER) used to verify the content pack signature.
// Baked into the bundle rather than served with the pack: the bundle is the
// trust root, and a signature travelling with its own key verifies anything.
export const CONTENT_SIGNING_PUBLIC_KEY_SPKI_B64 =
  '${publicKeyDer.toString('base64')}';
`,
  );

  const totalBytes = entries.reduce((n, e) => n + e.bytes, 0) + manifestBody.byteLength;
  console.log(
    `Content pack ${manifest.version}: ${manifest.counts.skills} skills, ` +
      `${manifest.counts.items} items, ${manifest.counts.kits} kits, ` +
      `${(totalBytes / 1024).toFixed(1)} KB, signed.`,
  );
}

build();

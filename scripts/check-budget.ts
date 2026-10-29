/**
 * Performance budget gate. ARCHITECTURE §8 / brief §8.
 *
 * Target is a five-year-old mid-range Android over 3G. Budgets are checked at
 * build time because a bundle regression is invisible on a developer laptop
 * and extremely visible on the device this is actually for.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');

const BUDGETS = {
  /** App shell: JS + CSS, gzipped. */
  shellGzipKb: 150,
  /** Content pack as shipped. */
  contentKb: 2048,
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(DIST);

const shellGzipBytes = files
  .filter((f) => /assets\/.*\.(js|css)$/.test(f) || f.endsWith('index.html'))
  .reduce((sum, f) => sum + gzipSync(readFileSync(f)).byteLength, 0);

const contentBytes = files
  .filter((f) => f.includes(`${'content'}/`))
  .reduce((sum, f) => sum + statSync(f).size, 0);

const shellKb = shellGzipBytes / 1024;
const contentKb = contentBytes / 1024;

const failures: string[] = [];
if (shellKb > BUDGETS.shellGzipKb) {
  failures.push(
    `app shell is ${shellKb.toFixed(1)} KB gzipped, over the ${BUDGETS.shellGzipKb} KB budget`,
  );
}
if (contentKb > BUDGETS.contentKb) {
  failures.push(
    `content pack is ${contentKb.toFixed(1)} KB, over the ${BUDGETS.contentKb} KB budget`,
  );
}

console.log(
  `Shell ${shellKb.toFixed(1)} / ${BUDGETS.shellGzipKb} KB gzipped · ` +
    `content ${contentKb.toFixed(1)} / ${BUDGETS.contentKb} KB`,
);

if (failures.length > 0) {
  console.error('\nPerformance budget exceeded:');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

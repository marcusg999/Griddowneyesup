/**
 * Content validation gate.
 *
 * Runs in CI. A content error fails the build rather than reaching a user who
 * is standing in the dark holding a filter they are about to misuse.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  catalogItemSchema,
  kitSchema,
  indicatorSchema,
  offerSchema,
  overlaysSchema,
  postureSchema,
  skillSchema,
} from './schema.js';

const LOCALE = 'en-US';
const CONTENT_DIR = join(process.cwd(), 'content', LOCALE);

/** CONTENT_POLICY §3.1 — content older than this fails rather than warns. */
const STALE_FAIL_MONTHS = 18;
const STALE_WARN_MONTHS = 12;

interface Problem {
  readonly where: string;
  readonly message: string;
}

function read(name: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT_DIR, name), 'utf8'));
}

function monthsSince(iso: string): number {
  const then = new Date(iso).getTime();
  const days = (Date.now() - then) / 86_400_000;
  return days / 30.44;
}

export function validateContent(): { problems: Problem[]; warnings: Problem[] } {
  const problems: Problem[] = [];
  const warnings: Problem[] = [];

  const rawSkills = read('skills.json');
  const rawItems = read('items.json');
  const rawKits = read('kits.json');
  const rawOverlays = read('overlays.json');
  const rawPosture = read('posture.json');
  const rawIndicators = read('indicators.json');
  const rawOffers = read('offers.json');

  const skills = [];
  for (const [i, raw] of (rawSkills as unknown[]).entries()) {
    const parsed = skillSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          where: `skills[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      continue;
    }
    skills.push(parsed.data);
  }

  const items = [];
  for (const [i, raw] of (rawItems as unknown[]).entries()) {
    const parsed = catalogItemSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          where: `items[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      continue;
    }
    items.push(parsed.data);
  }

  const kits = [];
  for (const [i, raw] of (rawKits as unknown[]).entries()) {
    const parsed = kitSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          where: `kits[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      continue;
    }
    kits.push(parsed.data);
  }

  for (const [i, raw] of (rawPosture as unknown[]).entries()) {
    const parsed = postureSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          where: `posture[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      continue;
    }
    const age = monthsSince(parsed.data.lastReviewed);
    if (age > STALE_WARN_MONTHS) {
      warnings.push({
        where: `posture:${parsed.data.id}`,
        message: `lastReviewed is ${age.toFixed(0)} months old; posture goes stale faster than skills`,
      });
    }
  }

  for (const [i, raw] of (rawIndicators as unknown[]).entries()) {
    const parsed = indicatorSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          where: `indicators[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      continue;
    }
    // An economic reading goes stale in weeks, not months.
    const ageDays = (Date.now() - new Date(parsed.data.asOf).getTime()) / 86_400_000;
    if (ageDays > 30) {
      warnings.push({
        where: `indicator:${parsed.data.id}`,
        message: `reading is ${ageDays.toFixed(0)} days old; economic indicators go stale fast`,
      });
    }
  }

  const parsedOffers = [];
  for (const [i, raw] of (rawOffers as unknown[]).entries()) {
    const parsed = offerSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          where: `offers[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
          message: issue.message,
        });
      }
      continue;
    }
    parsedOffers.push(parsed.data);
  }

  const overlaysParsed = overlaysSchema.safeParse(rawOverlays);
  if (!overlaysParsed.success) {
    for (const issue of overlaysParsed.error.issues) {
      problems.push({ where: `overlays.${issue.path.join('.')}`, message: issue.message });
    }
  }

  // --- Referential integrity ------------------------------------------------
  const itemIds = new Set(items.map((i) => i.id));

  if (itemIds.size !== items.length) {
    problems.push({ where: 'items', message: 'duplicate item ids' });
  }
  if (new Set(skills.map((s) => s.id)).size !== skills.length) {
    problems.push({ where: 'skills', message: 'duplicate skill ids' });
  }

  for (const offer of parsedOffers) {
    if (!itemIds.has(offer.itemId)) {
      problems.push({ where: `offer:${offer.id}`, message: `unknown item "${offer.itemId}"` });
    }
  }

  for (const skill of skills) {
    for (const m of skill.materials) {
      if (!itemIds.has(m)) {
        problems.push({ where: `skill:${skill.id}`, message: `unknown material "${m}"` });
      }
    }
  }

  for (const kit of kits) {
    for (const id of kit.baseItems) {
      if (!itemIds.has(id)) {
        problems.push({ where: `kit:${kit.id}`, message: `unknown base item "${id}"` });
      }
    }
    for (const id of kit.criticalItems) {
      if (!kit.baseItems.includes(id)) {
        problems.push({
          where: `kit:${kit.id}`,
          message: `critical item "${id}" is not in baseItems`,
        });
      }
    }
  }

  if (overlaysParsed.success) {
    for (const group of [overlaysParsed.data.hazard, overlaysParsed.data.dependent]) {
      for (const overlay of group) {
        for (const id of overlay.addsItems) {
          if (!itemIds.has(id)) {
            problems.push({ where: `overlay:${overlay.id}`, message: `unknown item "${id}"` });
          }
        }
        for (const id of overlay.criticalItems) {
          if (!overlay.addsItems.includes(id)) {
            problems.push({
              where: `overlay:${overlay.id}`,
              message: `critical item "${id}" is not in addsItems`,
            });
          }
        }
      }
    }
  }

  // --- Ladder integrity -----------------------------------------------------
  const rungs = kits.map((k) => k.rung).sort((a, b) => a - b);
  if (rungs.some((r, i) => r !== i + 1)) {
    problems.push({ where: 'kits', message: 'rungs must be consecutive from 1' });
  }

  // --- Review staleness (CONTENT_POLICY §3.1) -------------------------------
  for (const skill of skills) {
    const age = monthsSince(skill.lastReviewed);
    if (age > STALE_FAIL_MONTHS) {
      problems.push({
        where: `skill:${skill.id}`,
        message: `lastReviewed is ${age.toFixed(0)} months old (fails above ${STALE_FAIL_MONTHS})`,
      });
    } else if (age > STALE_WARN_MONTHS) {
      warnings.push({
        where: `skill:${skill.id}`,
        message: `lastReviewed is ${age.toFixed(0)} months old; due for review`,
      });
    }
  }

  return { problems, warnings };
}

// Run directly rather than when imported by the pack builder.
if (process.argv[1]?.endsWith('validate-content.ts')) {
  const { problems, warnings } = validateContent();

  for (const w of warnings) console.warn(`  warn  ${w.where}: ${w.message}`);

  if (problems.length > 0) {
    console.error(`\nContent validation failed with ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  error  ${p.where}: ${p.message}`);
    console.error('');
    process.exit(1);
  }

  console.log(`Content valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
}

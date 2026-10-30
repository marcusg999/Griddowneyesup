import { getJson } from '../fetch';
import type { SourceResult } from '../types';
import type { Brief, Signal } from '../schema';

/**
 * NOAA Space Weather Prediction Center, current NOAA scales.
 *
 * Three scales: R radio blackouts, S solar radiation, G geomagnetic. Each runs
 * 0 to 5. G is the one a household feels, through the grid and through GPS.
 *
 * The response is keyed by offset — "0" is now, "-1" is yesterday — rather
 * than being an array, which is worth knowing before reading the parser.
 */

interface ScaleBlock {
  readonly Scale?: string | null;
  readonly Text?: string | null;
}
interface SwpcScales {
  readonly [offset: string]: {
    readonly R?: ScaleBlock;
    readonly S?: ScaleBlock;
    readonly G?: ScaleBlock;
  };
}

const num = (block: ScaleBlock | undefined): number => {
  const parsed = Number(block?.Scale ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

export function parseSwpc(raw: unknown, now: Date): SourceResult {
  const current = (raw as SwpcScales)?.['0'];
  const g = num(current?.G);
  const r = num(current?.R);
  const s = num(current?.S);
  const worst = Math.max(g, r, s);

  const level: Signal['level'] = worst >= 3 ? 'active' : worst >= 1 ? 'elevated' : 'quiet';
  const headline =
    worst === 0
      ? 'Geomagnetic field quiet, no active scales'
      : `G${g} geomagnetic, R${r} radio, S${s} radiation`;

  const signal: Signal = {
    source: 'swpc',
    sourceName: 'NOAA Space Weather Prediction Center',
    level,
    headline,
    meansForYou:
      worst >= 3
        ? 'At this level GPS accuracy degrades and HF radio becomes unreliable. Grid operators are managing it; a household is not expected to do anything.'
        : worst >= 1
          ? 'Minor. Worth knowing if you rely on GPS or HF, not otherwise.'
          : 'Nothing to act on. GPS and HF radio are behaving normally.',
    url: 'https://www.swpc.noaa.gov/products/notifications-timeline',
    observedAt: now.toISOString(),
  };

  // Only a card when it is genuinely notable. A G1 every other week is how a
  // feed teaches people to stop reading it.
  const brief: Brief[] =
    worst >= 3
      ? [
          {
            id: `swpc-${now.toISOString().slice(0, 10)}-g${g}`,
            category: 'infrastructure',
            headline: `Space weather: ${headline}`,
            whatItMeansForYou:
              'Strong geomagnetic activity stresses long transmission lines and degrades GPS. Grid operators plan for this; the household version is knowing why your navigation is drifting.',
            url: 'https://www.swpc.noaa.gov/products/notifications-timeline',
            source: 'NOAA Space Weather Prediction Center',
            published: now.toISOString(),
            epistemicStatus: 'official',
            where: 'worldwide',
          },
        ]
      : [];

  return { signal, brief };
}

export async function collectSwpc(now: Date): Promise<SourceResult> {
  return parseSwpc(await getJson('https://services.swpc.noaa.gov/products/noaa-scales.json'), now);
}

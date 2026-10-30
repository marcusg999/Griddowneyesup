import type { CatalogItem, HazardId, ResourceKind } from '@/content/types';
import type { Coverage } from '@/features/supply/coverage';
import { crossesMilestone, nextMilestone, nextMove } from '@/features/supply/next';
import { t } from '@/i18n';

/**
 * One thing to do next, with its payoff in days.
 *
 * The app's score is days of coverage, and days of coverage is a physical
 * quantity nobody can fake. This card turns it into a loop: here is what runs
 * out first, here is the cheapest thing that fixes it, here is what your
 * number becomes, and here is the named milestone you are walking toward.
 *
 * It carries no purchase link. Commerce belongs on the acquisition surface
 * with its adjacent disclosure (§7.5), and this card's job is to say what to
 * do rather than where to buy it.
 */

const RESOURCE_LABEL: Readonly<Record<ResourceKind, string>> = {
  'water-litres': 'water',
  'calories-kcal': 'food',
  'heat-hours': 'heat',
  'power-wh': 'power',
  'sanitation-uses': 'sanitation',
};

const TIER_LABEL: Readonly<Record<string, string>> = {
  '72hour': t('tier.72hour'),
  twoWeek: t('tier.twoWeek'),
  oneMonth: t('tier.oneMonth'),
  season: t('tier.season'),
};

const money = (cents: number): string =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

const kg = (grams: number): string =>
  grams >= 1_000 ? `${(grams / 1_000).toFixed(grams >= 10_000 ? 0 : 1)} kg` : `${grams} g`;

export function NextMove({
  coverage,
  catalog,
  hazards,
}: {
  readonly coverage: readonly Coverage[];
  readonly catalog: readonly CatalogItem[];
  readonly hazards: readonly HazardId[] | undefined;
}) {
  const move = nextMove(coverage, catalog, hazards);
  if (!move) return null;

  const milestone = nextMilestone(move.daysNow);
  const crossed = crossesMilestone(move);
  const resource = RESOURCE_LABEL[move.resource];

  return (
    <article className="card next-move">
      <p className="next-move__kicker">
        {resource} runs out first, so {resource} is the move
      </p>

      <h3 className="next-move__item">
        {move.units > 1 ? `${move.units} × ` : ''}
        {move.item.name}
      </h3>
      <p className="meta">{move.item.spec}</p>

      <p className="next-move__payoff">
        <span className="tnum">{move.resourceDaysNow}</span>
        {' → '}
        <span className="tnum next-move__after">{move.resourceDaysAfter}</span>{' '}
        days of {resource}
        {move.addedCostCents === undefined ? '' : `, for ${money(move.addedCostCents)}`}
        {` and ${kg(move.addedWeightG)}`}
      </p>

      {/* The household number, which is the one that counts, and the reason
          it may not move as far. "You fixed water and now food is the limit"
          is the single most useful idea in preparedness, and it is much
          easier to learn by watching it happen than by being told. */}
      <p className="next-move__household">
        Your household figure goes from <span className="tnum">{move.daysNow}</span> to{' '}
        <span className="tnum">{move.daysAfter}</span> days
        {move.thenLimitedBy
          ? `, because ${RESOURCE_LABEL[move.thenLimitedBy]} becomes the next limit.`
          : '.'}
      </p>

      {crossed && TIER_LABEL[crossed] ? (
        <p className="next-move__milestone">
          That crosses <strong>{TIER_LABEL[crossed]}</strong>.
        </p>
      ) : milestone && TIER_LABEL[milestone.tier] ? (
        <p className="next-move__milestone">
          <span className="tnum">{milestone.daysAway}</span>{' '}
          {milestone.daysAway === 1 ? 'day' : 'days'} from{' '}
          <strong>{TIER_LABEL[milestone.tier]}</strong>.
        </p>
      ) : null}
    </article>
  );
}

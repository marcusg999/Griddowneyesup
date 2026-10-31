import type { Offer } from '@/content/types';
import { mayShowOffers, type CommerceSurface } from '@/features/commerce/offers';

/**
 * Where to buy something. §14, CONTENT_POLICY §7.
 *
 * Four rules, all visible in this file:
 *   - Disclosure renders adjacent to the link, never in a page footer.
 *   - Affiliate status is a badge on the link itself, not fine print.
 *   - This component cannot reorder anything; it receives offers for one item.
 *   - It refuses to render on a threat, posture or exposure surface, because
 *     a buy button next to a price shock is fear as a conversion mechanic.
 */
export function Offers({
  offers,
  surface,
}: {
  offers: readonly Offer[];
  surface: CommerceSurface;
}) {
  // Belt and braces: the call sites already respect this, and a future call
  // site that does not will render nothing rather than quietly breaking §6.
  if (!mayShowOffers(surface) || offers.length === 0) return null;

  return (
    <ul className="offers">
      {offers.map((offer) => (
        <li key={offer.id} data-affiliate={offer.affiliate}>
          {/* The merchant and nothing else. A price here would be a quote
              from a shop, cached inside a signed pack and read weeks later —
              see the note on Offer.asOf. The catalogue's typical cost is the
              number the planner uses and the only one this app stands
              behind. */}
          <a href={offer.url} rel="noreferrer noopener sponsored" target="_blank">
            {offer.merchant}
          </a>
          {offer.affiliate && (
            <span className="offers__badge" title="We earn a commission on this link">
              paid link
            </span>
          )}
          <small className="offers__disclosure">
            {offer.affiliate
              ? 'We earn a commission if you buy through this link. It did not affect what is recommended or the order it appears in.'
              : 'We earn nothing from this link.'}
          </small>
        </li>
      ))}
    </ul>
  );
}

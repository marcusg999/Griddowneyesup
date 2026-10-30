import { expect, test, type Page } from '@playwright/test';

/**
 * THE RELEASE GATE.
 *
 * Brief §2: "Treat 'airplane mode works' as a release gate, not a feature. A
 * build that fails the offline test suite does not ship."
 *
 * Every test in this file runs with the browser context genuinely offline —
 * not with mocked responses. If any of these fail, the product's central
 * claim is false.
 */

/** Warm the service worker and content pack, then cut the network for good. */
async function installThenGoOffline(page: Page): Promise<void> {
  await page.goto('/');

  await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
    undefined,
    { timeout: 30_000 },
  );

  // The content pack must reach IndexedDB before we pull the plug, since that
  // is the thing the offline claim rests on.
  await expect(page.getByRole('link', { name: 'Skills' })).toBeVisible();
  await page.goto('/skills');
  await expect(page.getByText(/\d+ of \d+ skills/)).toBeVisible({ timeout: 15_000 });

  await page.context().setOffline(true);
}

test.describe('offline release gate', () => {
  test('cold boots with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);

    // A genuine cold boot at the app root: fresh navigation, no warm state.
    // (The warm-up helper leaves us on /skills.)
    await page.goto('/');
    await page.reload();

    // The Today route's h1 is the readiness state, not the tab name — the page
    // reports what is happening rather than which tab you are on.
    await expect(
      page.getByRole('heading', { name: /Blue Sky|Watch|Grey Sky/, level: 1 }),
    ).toBeVisible();
    // Never a spinner, never an error page, never a blank screen (§2).
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('navigates every route with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);

    const routes: Array<{ href: string; heading: RegExp }> = [
      { href: '/', heading: /Blue Sky|Watch|Grey Sky/ },
      { href: '/supplies', heading: /^Supplies$/ },
      { href: '/plan', heading: /^Plan$/ },
      { href: '/skills', heading: /^Skills$/ },
      { href: '/settings', heading: /^Settings$/ },
    ];

    for (const route of routes) {
      await page.goto(route.href);
      await expect(
        page.getByRole('heading', { name: route.heading, level: 1 }),
      ).toBeVisible();
    }
  });

  test('the library can be browsed by someone who has no search term', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/skills');

    // Search only helps someone who already has the word. The categories are
    // the way in for someone who does not.
    //
    // Retrying assertions throughout: `expect(await locator.count())` reads
    // once and never retries, so it races hydration and passes or fails on
    // how warm the machine is. toContainText and toHaveCount wait.
    const chips = page.locator('.browse__chip');
    await expect(chips.first()).toContainText('Everything');
    expect(await chips.count()).toBeGreaterThan(5);

    await page.getByRole('button', { name: /^water/ }).click();
    await expect(page.locator('p.meta[role="status"]')).toContainText('water');
    const cards = page.locator('.skill-card');
    await expect(cards.first()).toBeVisible();
    const filtered = await cards.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(50);

    // The category narrows the search rather than replacing it.
    await page.getByLabel('Search the library').fill('filter');
    expect(await page.locator('.skill-card').count()).toBeLessThanOrEqual(filtered);

    // And the active category clears itself, so the filter is never a trap.
    await page.getByLabel('Search the library').fill('');
    await page.getByRole('button', { name: /^water/ }).click();
    await expect(page.locator('p.meta[role="status"]')).toContainText('50 of 50');
  });

  test('searches the full-text library with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/skills');

    // Count-agnostic: the library grows, and a gate pinned to its size would
    // fail on every content commit rather than on a real regression.
    const counter = page.getByText(/^\d+ of \d+ skills$/);
    await expect(counter).toBeVisible();
    const all = Number((await counter.textContent())?.match(/of (\d+)/)?.[1] ?? 0);
    expect(all).toBeGreaterThan(1);

    await page.getByLabel('Search the library').fill('purification');
    await expect(counter).toBeVisible();
    const matched = Number((await counter.textContent())?.match(/^(\d+)/)?.[1] ?? -1);
    expect(matched, 'search should narrow the library').toBeGreaterThan(0);
    expect(matched, 'search should narrow the library').toBeLessThan(all);

    await page.getByLabel('Search the library').fill('bleach');
    await expect(
      page.getByRole('heading', { name: /unscented household bleach/i }),
    ).toBeVisible();
  });

  test('search ranks the right skill first', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/skills');

    /*
     * Relevance, not just recall. Fuzzy OR matching once put the charcoal
     * filtration column at the top of a search for "carbon monoxide" — a near
     * match on "charcoal" with nothing matching "monoxide" at all.
     */
    const expectations: Array<[string, RegExp]> = [
      ['carbon monoxide', /poisoning anyone/i],
      ['botulism', /home canning/i],
      ['tourniquet', /stopping serious bleeding/i],
      ['bleach', /disinfecting surfaces/i],
    ];

    for (const [query, topResult] of expectations) {
      await page.getByLabel('Search the library').fill(query);
      await expect(
        page.locator('.skill-card__title').first(),
        `"${query}" should rank the right skill first`,
      ).toHaveText(topResult);
    }
  });

  test('renders a skill, with its limits above the steps', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/skills/water-improvised-column');

    await expect(
      page.getByRole('heading', { name: /sand and charcoal filtration column/i }),
    ).toBeVisible();

    const limits = page.getByRole('region', { name: /what this does not do/i });
    await expect(limits).toBeVisible();
    await expect(limits).toContainText(/does NOT make water microbiologically safe/i);

    // The stamp is the thing that makes the limits unmissable, so it is part
    // of the gate rather than decoration that may silently disappear.
    await expect(
      limits.getByRole('img', { name: /stamped: does not purify/i }),
    ).toBeVisible();

    // CONTENT_POLICY §3.2: the limits must come BEFORE the steps, because
    // after the steps is after the point someone has started doing it.
    const limitsY = await limits.boundingBox().then((b) => b?.y ?? Infinity);
    const stepsY = await page
      .getByRole('heading', { name: 'Steps' })
      .boundingBox()
      .then((b) => b?.y ?? -Infinity);
    expect(limitsY).toBeLessThan(stepsY);
  });

  test('mutates inventory offline and the mutation survives a reload', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');

    await page.getByLabel('Which kit').selectOption('home');
    await page.getByLabel('What').selectOption('water-stored-gal');
    await page.getByRole('button', { name: /^Add to/ }).click();

    await expect(page.getByTestId('inventory-row')).toHaveCount(1);

    // Still offline, and the write must have gone to IndexedDB rather than
    // waiting on a server that is not there.
    await page.reload();
    await expect(page.getByTestId('inventory-row')).toHaveCount(1);
    await expect(page.getByTestId('inventory-row')).toContainText('Stored drinking water');
  });

  test('the ladder reads as a descent, with the reachable rung at the top', async ({
    page,
  }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');

    // The section is a climb DOWN into deeper cover. Framing and order have to
    // agree: a list with no direction is what made this confusing before.
    await expect(page.getByRole('heading', { name: 'The ladder down' })).toBeVisible();

    const steps = page.locator('.ladder__step');
    await expect(steps).toHaveCount(7);

    // First step is the one you can act on, and it needs no scrolling.
    await expect(steps.first()).toHaveAttribute('data-locked', 'false');
    await expect(steps.first()).toContainText('Everyday Carry');
    await expect(steps.last()).toContainText('INCH Bag');

    // The lock explains itself spatially, which is the whole mental model.
    await expect(steps.nth(1)).toContainText('it is the rung above this one');
  });

  test('the rung labels actually render', async ({ page }) => {
    await installThenGoOffline(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/supplies');

    // Regression: the labels used to sit inside .card, whose clip-path cut off
    // anything at a negative offset — so the marginalia existed in the DOM and
    // had never once been drawn. In the DOM is not the same as on the screen.
    const label = page.locator('.ladder__step > .margin-note').first();
    await expect(label).toHaveText(/rung 1/);
    const box = await label.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.x ?? -1).toBeGreaterThan(0);
  });

  test('coverage is computed offline from local inventory', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');

    // Four gallons against one adult's 3.785 L/day is four days of water.
    await page.getByLabel('Which kit').selectOption('home');
    await page.getByLabel('What').selectOption('water-stored-gal');
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: /^Add to/ }).click();
    }

    await page.goto('/');
    await expect(page.getByText(/days of water/)).toBeVisible();
    await expect(page.getByText(/4 days of water/)).toBeVisible();
  });

  test('Grey Sky strips to four things and hides every gamification element', async ({
    page,
  }) => {
    await installThenGoOffline(page);

    await page.goto('/settings');
    await page.getByTestId('state-grey-sky').click();

    await page.goto('/');

    // §3: four things only.
    await expect(page.getByRole('link', { name: 'My Plan' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Water' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shelter / Heat' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible();

    // Policy G08: no badges, no tiers, no streaks, no celebration.
    await expect(page.getByText(/readiness tier/i)).toHaveCount(0);
    await expect(page.getByText(/the ladder/i)).toHaveCount(0);
    await expect(page.getByText(/nothing notable near you/i)).toHaveCount(0);

    await page.goto('/supplies');
    await expect(page.getByText(/the ladder/i)).toHaveCount(0);
  });

  test('WATCH shows an action queue derived from this household, not a checklist', async ({
    page,
  }) => {
    await installThenGoOffline(page);

    await page.goto('/settings');
    await page.getByTestId('state-watch').click();
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Do these first' })).toBeVisible();
    const entries = page.locator('.queue > li');
    expect(await entries.count()).toBeGreaterThan(0);

    // An empty household gets the entries its own gaps imply.
    await expect(page.getByText('Agree one place to meet')).toBeVisible();
    await expect(page.getByText('Name someone two states away')).toBeVisible();

    // And NOT the ones it cannot be known to need. No fuel spend is recorded,
    // so no fuel entry; no prescriptions logged, so nothing about refills.
    await expect(page.getByText(/Fill the tank/)).toHaveCount(0);
    await expect(page.getByText(/Ask for the refill/)).toHaveCount(0);

    // In WATCH the reading suggestions give way to the queue entirely.
    await expect(page.getByText(/Worth doing/)).toHaveCount(0);
  });

  test('the WATCH queue follows the inventory it is derived from', async ({ page }) => {
    await installThenGoOffline(page);

    await page.goto('/settings');
    await page.getByTestId('state-watch').click();

    // With nothing stored, the water entry has to improvise.
    await page.goto('/');
    await expect(page.getByText(/Fill the bathtub/)).toBeVisible();

    // An empty container holds no water, so the shortfall stands — but the
    // instruction changes, because now there is something to fill.
    await page.goto('/supplies');
    await page.getByLabel('Which kit').selectOption('home');
    await page.getByLabel('What').selectOption('water-container-7gal');
    await page.getByRole('button', { name: /^Add to/ }).click();

    await page.goto('/');
    await expect(page.getByText('Fill the 1 container you already own')).toBeVisible();
    await expect(page.getByText(/Fill the bathtub/)).toHaveCount(0);
  });

  test('the WATCH queue carries no purchase links', async ({ page }) => {
    await installThenGoOffline(page);

    await page.goto('/settings');
    await page.getByTestId('state-watch').click();
    await page.goto('/');

    // CONTENT_POLICY §7.5: `today` is a commerce-forbidden surface, and the
    // queue renders there. Suppression is absence, not invisibility.
    await expect(page.locator('.queue a[href^="http"]')).toHaveCount(0);
    await expect(page.locator('.queue').getByText(/buy|shop|\$/i)).toHaveCount(0);
  });

  test('Grey Sky does not show the WATCH queue', async ({ page }) => {
    await installThenGoOffline(page);

    await page.goto('/settings');
    await page.getByTestId('state-grey-sky').click();
    await page.goto('/');

    await expect(page.locator('.queue')).toHaveCount(0);
    await expect(page.getByText(/Do these first/)).toHaveCount(0);
  });

  test('the digest renders with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/');

    // The band is the Threat Index (D11). It is a word, never a score.
    await expect(page.locator('.band__label')).toBeVisible();
    await expect(page.locator('.band__confidence')).toContainText(/of 6 signals reporting/);

    // The default region is a normal day, and §5 makes that the designed
    // first-class screen rather than a fallback.
    await expect(page.getByText('Nothing notable near you')).toBeVisible();

    // §5: finite feed. It ends, and it says so.
    await expect(page.getByText(/no more to scroll/)).toBeVisible();
  });

  test('the digest says it is a sample rather than passing for real', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/');

    // The ingestion pipeline does not exist yet. Illustrative signals wearing
    // the authority of a government feed would be the worst thing this surface
    // could do, so the notice is unmissable and the band cannot move state.
    await expect(page.locator('.band__sample')).toBeVisible();
    await expect(page.locator('.band__sample')).toContainText(/live feed is not connected/);
  });

  test('the band justifies itself, which is why it is a band and not a number', async ({
    page,
  }) => {
    await installThenGoOffline(page);
    await page.goto('/settings');
    await page.getByLabel(/County FIPS/).fill('06075');
    await page.locator('#county ~ button', { hasText: 'Save' }).first().click();

    await page.goto('/');
    await expect(page.locator('.band__label')).toContainText('Active');

    // Still offline: the digest was precached, verified against the bundled
    // key and stored, all with the radio off.
    const cards = page.locator('.signal');
    expect(await cards.count()).toBeGreaterThan(0);

    // Every card carries its source, a direct link and its age (§4.4).
    await expect(cards.first().locator('.signal__source')).toContainText(/ago/);
    await expect(cards.first().locator('a[href^="https://"]')).toBeVisible();
    await expect(cards.first().getByText(/What this means for you/i)).toBeVisible();

    await page.locator('.band__why summary').click();
    await expect(page.locator('.band__why li').first()).toContainText(/:/);
  });

  test('a stale signal does not raise the band but keeps its card', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/settings');
    await page.getByLabel(/County FIPS/).fill('06075');
    await page.locator('#county ~ button', { hasText: 'Save' }).first().click();
    await page.goto('/');

    // The 06075 sample carries a 30-hour-old space weather reading, which is
    // past its window. It is reported as such rather than silently dropped.
    await expect(page.locator('.band__confidence')).toContainText(/freshness window/);
  });

  // The hosts the signal collectors actually cite, matched by domain rather
  // than by prefix: the NWS link is alerts.weather.gov, and a pattern anchored
  // on `weather.` rejected it while claiming to allow NWS. Any subdomain of
  // these is a government source; anything else on a threat surface is a §7.5
  // violation, which is what this test is for.
  const SOURCE_HOST =
    /^https:\/\/([a-z0-9-]+\.)*(weather\.gov|airnow\.gov|usgs\.gov|fema\.gov|noaa\.gov)(\/|$)/;

  test('no purchase links reach the digest', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/settings');
    await page.getByLabel(/County FIPS/).fill('06075');
    await page.locator('#county ~ button', { hasText: 'Save' }).first().click();
    await page.goto('/');

    // Wait for the digest to land before reading the DOM: the surface renders
    // its loading line first, and collecting links from it would pass for the
    // wrong reason.
    await expect(page.locator('.signal').first()).toBeVisible();

    // §7.5: commerce may never appear on a threat surface. The only external
    // links here are the sources the signals cite.
    const hrefs = await page.locator('.signal a').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(SOURCE_HOST);
    }
    await expect(page.locator('.signal').getByText(/buy|shop|price/i)).toHaveCount(0);
  });

  test('Grey Sky shows no digest at all', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/settings');
    await page.getByTestId('state-grey-sky').click();
    await page.goto('/');

    await expect(page.locator('.band')).toHaveCount(0);
    await expect(page.locator('.signal')).toHaveCount(0);
    await expect(page.getByText(/no more to scroll/)).toHaveCount(0);
  });

  test('the status bar says offline, rather than claiming it never synced', async ({
    page,
  }) => {
    await installThenGoOffline(page);
    await page.goto('/');

    // It used to say "Never synced" unconditionally — true on day one, a lie
    // from the first refresh on, and on screen either way.
    await expect(page.locator('.statusbar__sync')).toContainText(/Offline/);
    await expect(page.locator('.statusbar__sync')).not.toContainText(/Never synced/);
  });

  test('regaining the network pulls without the app being reopened', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/');
    await expect(page.locator('.statusbar__sync')).toContainText(/Offline/);

    // A phone walking back into WiFi. Nothing is reopened, nothing is
    // navigated: the page is sitting exactly where it was.
    await page.context().setOffline(false);

    // "Last synced" is the assertion that matters. Merely losing the Offline
    // label would prove only that the browser's online flag flipped — this
    // proves a fetch went out, came back, verified, and was recorded.
    await expect(page.locator('.statusbar__sync')).toContainText(/Last synced/, {
      timeout: 10_000,
    });
  });

  test('no render path awaits the network', async ({ page }) => {
    await installThenGoOffline(page);

    // Any request that escapes the service worker while offline would be a
    // render-path network dependency. This is the assertion that keeps the
    // premise true through future refactors.
    //
    // ERR_ABORTED is excluded, and the distinction matters: it means the
    // browser cancelled a request nobody is waiting for any more, which
    // happens two ways here. A navigation tears down a document with the pack
    // manifest fetch still in flight, and refreshSnapshot's own 3s
    // AbortController fires. Neither is a request that could not be served
    // offline — the second is the timeout working exactly as designed, and
    // counting it would fail the gate for correct behaviour.
    //
    // Everything else still fails, and the error text travels with the URL so
    // the next failure says what went wrong instead of only where.
    const failed: string[] = [];
    page.on('requestfailed', (request) => {
      const error = request.failure()?.errorText ?? 'unknown error';
      if (error.includes('ERR_ABORTED')) return;
      failed.push(`${error} ${request.url()}`);
    });

    for (const route of ['/', '/supplies', '/plan', '/skills', '/settings']) {
      await page.goto(route);
      await expect(page.locator('#root')).not.toBeEmpty();
      // Let the page settle before navigating away, so the next goto is not
      // what cancels the fetch this test is watching.
      await page.waitForLoadState('networkidle');
    }

    expect(failed, `offline requests escaped the cache:\n${failed.join('\n')}`).toEqual([]);
  });
});

test.describe('standing posture', () => {
  test('renders as background and does NOT move the readiness state', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Worth knowing' })).toBeVisible();
    await expect(page.getByText(/Background, not an alert/i)).toBeVisible();

    // CONTENT_POLICY §9.1: no geopolitical or defense item may change the
    // readiness state. A policy announcement has no threshold that would ever
    // bring the state back down, so it must never be able to raise it.
    await expect(page.getByRole('status')).toContainText('Blue Sky');
    await expect(page.getByText(/does not change your readiness state/i)).toBeVisible();

    // Epistemic status is shown rather than flattened into the prose.
    await expect(page.getByText(/Reported, not confirmed/i)).toBeVisible();
  });

  test('is suppressed entirely in Grey Sky', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/settings');
    await page.getByTestId('state-grey-sky').click();
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Worth knowing' })).toHaveCount(0);
    await expect(page.getByText(/FORTRESS/i)).toHaveCount(0);
  });
});

test.describe('achievements and rotation', () => {
  async function add(page: Page, kit: string, item: string, times = 1) {
    await page.getByLabel('Which kit').selectOption(kit);
    await page.getByLabel('What').selectOption(item);
    for (let i = 0; i < times; i += 1) {
      await page.getByRole('button', { name: /^Add to/ }).click();
    }
  }

  test('earns an achievement from real stock, not from using the app', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');

    // Water, calories and sanitation all have to clear three days — the
    // binding set. Buying only water earns nothing.
    await add(page, 'home', 'water-stored-gal', 4);
    await expect(page.getByTestId('achievement')).toHaveCount(0);

    await add(page, 'home', 'food-shelf-stable-day', 4);
    await add(page, 'home', 'toilet-bucket-kit', 1);

    await expect(page.getByTestId('achievement').filter({ hasText: '72 Hours' })).toBeVisible();

    // Earned once, and it survives a reload because it is stored, not derived
    // from a session.
    await page.reload();
    await expect(page.getByTestId('achievement').filter({ hasText: '72 Hours' })).toBeVisible();
  });

  test('queues an expiring item as something to use, not as a warning', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');

    await page.getByLabel('Which kit').selectOption('home');
    await page.getByLabel('What').selectOption('food-shelf-stable-day');
    await page.getByLabel('Expires (optional)').fill('2026-11-15');
    await page.getByRole('button', { name: /^Add to/ }).click();

    await expect(page.getByRole('heading', { name: 'Rotation' })).toBeVisible();
    await expect(page.getByText('Still good today')).toBeVisible();
    await expect(page.getByText(/Use it, then replace it/)).toBeVisible();
  });

  test('Grey Sky hides achievements and the rotation queue', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');
    await add(page, 'home', 'water-stored-gal', 4);
    await add(page, 'home', 'food-shelf-stable-day', 4);
    await add(page, 'home', 'toilet-bucket-kit', 1);
    await expect(page.getByTestId('achievement').first()).toBeVisible();

    await page.goto('/settings');
    await page.getByTestId('state-grey-sky').click();
    await page.goto('/supplies');

    // Policy G08: no badges, no scores, no celebration in Grey Sky.
    await expect(page.getByTestId('achievement')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Rotation' })).toHaveCount(0);
  });
});

test.describe('economic exposure and commerce', () => {
  test('exposure shows a measured reading, its chain and its exit condition', async ({
    page,
  }) => {
    await installThenGoOffline(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Exposure' })).toBeVisible();
    await expect(page.getByText('Retail diesel').first()).toBeVisible();
    await expect(page.getByText(/Observed readings, not forecasts/i)).toBeVisible();

    // The transmission chain renders as links, not as a narrative paragraph.
    await expect(page.getByText('Freight cost').first()).toBeVisible();
    // Both indicators carry one; the app is right and the selector was loose.
    await expect(page.getByText(/What would end this:/).first()).toBeVisible();

    // Epistemic honesty: a relayed reading says so.
    // Both indicators carry a relayed-reading caveat, which is the point.
    await expect(page.getByText(/Reading relayed, not read from source/i)).toHaveCount(2);
  });

  test('NO purchase links appear on the threat or exposure surfaces', async ({ page }) => {
    await installThenGoOffline(page);

    // CONTENT_POLICY §7.5. Pairing a price shock with a buy button is fear as
    // a conversion mechanic, which §6 forbids outright. This is the test that
    // keeps that true as the app grows.
    for (const route of ['/', '/plan', '/skills']) {
      await page.goto(route);
      await expect(page.locator('[data-affiliate]')).toHaveCount(0);
      await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
    }
  });

  test('offers appear on the acquisition surface, each with adjacent disclosure', async ({
    page,
  }) => {
    await installThenGoOffline(page);
    await page.goto('/supplies');

    await expect(page.getByRole('heading', { name: 'What to buy next' })).toBeVisible();

    const paid = page.locator('[data-affiliate="true"]').first();
    await expect(paid).toBeVisible();
    // Badge on the link itself, not fine print at the bottom of the page.
    await expect(paid.getByText('paid link')).toBeVisible();
    await expect(paid.getByText(/We earn a commission if you buy through this link/i)).toBeVisible();
    await expect(paid.getByText(/did not affect what is recommended/i)).toBeVisible();

    // A non-affiliate link says so too, rather than staying silent.
    await expect(
      page.locator('[data-affiliate="false"]').first().getByText(/We earn nothing/i),
    ).toBeVisible();
  });

  test('Grey Sky suppresses exposure and every purchase link', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/settings');
    await page.getByTestId('state-grey-sky').click();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Exposure' })).toHaveCount(0);

    await page.goto('/supplies');
    await expect(page.locator('[data-affiliate]')).toHaveCount(0);
  });
});

test.describe('content pack integrity', () => {
  test('the pack is signed and verifies against the bundled key', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await page.goto('/settings');

    // A pack that failed verification is never installed, so a version string
    // here means the signature and every artifact hash checked out.
    await expect(page.getByText(/Pack \d{4}-\d{2}-\d{2}\./)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/\d+ skills, \d+ items/)).toBeVisible();
  });
});

test.describe('plan builder and paper', () => {
  async function fill(page: Page, label: string, value: string) {
    const field = page.getByLabel(label, { exact: false }).first();
    await field.fill(value);
    await field.blur();
  }

  test('builds a plan offline and it survives a reload', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/plan');

    await fill(page, 'Primary — near home', 'The oak at the end of the driveway');
    await fill(page, 'Secondary — outside the neighbourhood', 'Library car park');

    await fill(page, 'Name', 'Ruth Alvarez');
    await fill(page, 'Phone', '+1 555 0137');
    await page.getByLabel('Lives outside this region').check();
    await page.getByRole('button', { name: 'Add contact' }).click();
    await expect(page.getByTestId('contact-row')).toHaveCount(1);

    // Still offline: the write went to IndexedDB, not to a server that is not
    // there, and a half-finished plan must survive the tab closing.
    await page.reload();
    await expect(page.getByTestId('contact-row')).toContainText('Ruth Alvarez');
    await expect(
      page.getByLabel('Primary — near home', { exact: false }),
    ).toHaveValue('The oak at the end of the driveway');
  });

  test('warns on the printed sheet when the plan is incomplete', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/print/plan');

    // A printed plan with blanks is worse than none, because it looks
    // finished. The sheet has to say so.
    await expect(page.getByText(/Incomplete/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Household Emergency Plan/ })).toBeVisible();
  });

  test('exports a PDF offline, from every printable document', async ({ page }) => {
    await installThenGoOffline(page);

    for (const path of [
      '/print/plan',
      '/print/rally-card',
      '/print/contacts',
      '/print/checklist',
      '/print/skill/water-improvised-column',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /Print \/ Save as PDF/ })).toBeVisible();

      // Render through the real print pipeline and produce an actual document.
      await page.emulateMedia({ media: 'print' });
      const pdf = await page.pdf({ format: 'Letter', printBackground: false });
      await page.emulateMedia({ media: 'screen' });

      expect(pdf.subarray(0, 5).toString('latin1'), `${path} is not a PDF`).toBe('%PDF-');
      expect(pdf.byteLength, `${path} produced an empty PDF`).toBeGreaterThan(8_000);
    }
  });

  test('print sheets carry no app chrome and no colour dependency', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/print/plan');

    // §7: black and white, legible at arm's length. The app's tab bar, status
    // bar and readiness theming must not reach paper.
    await expect(page.locator('.tabbar')).toHaveCount(0);
    await expect(page.locator('.statusbar')).toHaveCount(0);

    await page.emulateMedia({ media: 'print' });
    const ink = await page.evaluate(() => {
      const paper = document.querySelector('.sheet-paper');
      if (!paper) return null;
      const cs = getComputedStyle(paper);
      return { color: cs.color, background: cs.backgroundColor };
    });
    expect(ink?.color).toBe('rgb(0, 0, 0)');
    await page.emulateMedia({ media: 'screen' });
  });

  test('the skill sheet prints its limits above its steps', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/print/skill/water-improvised-column');

    const limits = await page
      .getByText(/What this does NOT do/i)
      .boundingBox();
    const steps = await page.getByRole('heading', { name: 'Steps' }).boundingBox();
    expect(limits?.y ?? Infinity).toBeLessThan(steps?.y ?? -Infinity);
  });
});

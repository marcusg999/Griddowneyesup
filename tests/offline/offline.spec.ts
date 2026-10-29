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
  await expect(page.getByText(/of 6 skills/)).toBeVisible({ timeout: 15_000 });

  await page.context().setOffline(true);
}

test.describe('offline release gate', () => {
  test('cold boots with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);

    // A genuine cold boot at the app root: fresh navigation, no warm state.
    // (The warm-up helper leaves us on /skills.)
    await page.goto('/');
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
    // Never a spinner, never an error page, never a blank screen (§2).
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('navigates every route with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);

    const routes = [
      { href: '/', heading: 'Today' },
      { href: '/supplies', heading: 'Supplies' },
      { href: '/plan', heading: 'Plan' },
      { href: '/skills', heading: 'Skills' },
      { href: '/settings', heading: 'Settings' },
    ];

    for (const route of routes) {
      await page.goto(route.href);
      await expect(
        page.getByRole('heading', { name: route.heading, level: 1 }),
      ).toBeVisible();
    }
  });

  test('searches the full-text library with the network disabled', async ({ page }) => {
    await installThenGoOffline(page);
    await page.goto('/skills');

    await expect(page.getByText('6 of 6 skills')).toBeVisible();

    await page.getByLabel('Search the library').fill('purification');
    await expect(page.getByText(/^[1-5] of 6 skills$/)).toBeVisible();

    await page.getByLabel('Search the library').fill('bleach');
    await expect(
      page.getByRole('heading', { name: /unscented household bleach/i }),
    ).toBeVisible();
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

  test('no render path awaits the network', async ({ page }) => {
    await installThenGoOffline(page);

    // Any request that escapes the service worker while offline would be a
    // render-path network dependency. This is the assertion that keeps the
    // premise true through future refactors.
    const failed: string[] = [];
    page.on('requestfailed', (request) => failed.push(request.url()));

    for (const route of ['/', '/supplies', '/plan', '/skills', '/settings']) {
      await page.goto(route);
      await expect(page.locator('#root')).not.toBeEmpty();
    }

    expect(failed, `offline requests escaped the cache:\n${failed.join('\n')}`).toEqual([]);
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
    await expect(page.getByText(/6 skills, 30 items/)).toBeVisible();
  });
});

/*
 * Pending — these land with their build-order steps and are deliberately not
 * stubbed, because a passing stub is worse than a visible gap.
 *
 *   build a plan      → step 3 (plan builder)
 *   export a PDF      → step 3 (PDF export)
 *   run a drill       → v1.1 (drills)
 */
test.describe('pending build steps', () => {
  test.fixme('builds a plan offline', async () => {});
  test.fixme('exports a PDF offline', async () => {});
});

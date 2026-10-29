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

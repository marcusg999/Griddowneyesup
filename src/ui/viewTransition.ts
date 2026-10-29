/**
 * Native View Transitions, used for shared-element morphs between routes.
 *
 * No library. The API is a browser primitive and the fallback is simply a
 * normal navigation, which is the right failure mode for a product whose
 * whole premise is that the baseline must work.
 */

const HERO_NAME = 'skill-hero';

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs `navigate` inside a view transition, optionally morphing `heroEl` into
 * whatever element on the next page claims the same transition name.
 *
 * The name is applied to exactly one element at a time, which is the API's
 * requirement — two elements sharing a name aborts the transition.
 */
export function navigateWithTransition(
  navigate: () => void,
  heroEl?: HTMLElement | null,
): void {
  // Typed in newer DOM libs but not implemented everywhere, so feature-check
  // rather than trusting the type.
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    navigate();
    return;
  }

  if (heroEl) heroEl.style.viewTransitionName = HERO_NAME;

  const transition = document.startViewTransition(() => {
    navigate();
  });

  void transition.finished.finally(() => {
    if (heroEl) heroEl.style.viewTransitionName = '';
  });
}

export { HERO_NAME };

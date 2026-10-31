import { useCallback, useEffect } from 'react';
import { Link, Route, Router, Switch, useLocation, useRoute } from 'wouter';
import { ContentProvider } from '@/state/content';
import { ReadinessProvider, useReadiness } from '@/state/readiness';
import { useLastSynced } from '@/state/sync';
import { timeAgo } from '@/ui/relativeTime';
import { navigateWithTransition } from '@/ui/viewTransition';
import { t } from '@/i18n';
import { Today } from './pages/Today';
import { Supplies } from './pages/Supplies';
import { Plan } from './pages/Plan';
import { Skills } from './pages/Skills';
import { SkillDetail } from './pages/SkillDetail';
import { Settings } from './pages/Settings';
import { PrintView } from './print/PrintView';

function StatusBar() {
  const { state } = useReadiness();
  const { lastSyncedAt, online } = useLastSynced();

  // This line claimed "Never synced" unconditionally, which stopped being true
  // at the first refresh and stayed on screen anyway.
  const syncLine = !online
    ? t('sync.offline')
    : lastSyncedAt
      ? t('sync.lastSynced', { ago: timeAgo(lastSyncedAt) })
      : t('sync.neverSynced');
  const band = state === 'grey-sky' ? 'active' : state === 'watch' ? 'elevated' : 'quiet';
  const label =
    state === 'grey-sky'
      ? t('state.greySky')
      : state === 'watch'
        ? t('state.watch')
        : t('state.blueSky');

  return (
    <div className="statusbar" role="status">
      <span className="statusbar__dot" data-band={band} aria-hidden="true" />
      <strong>{label}</strong>
      {/* Offline is a labelled, normal state. Never a spinner, never an error.
          Each of the three says "everything here still works", because that is
          the point of all three. */}
      <span className="statusbar__sync">{syncLine}</span>
    </div>
  );
}

function TabLink({ href, label }: { href: string; label: string }) {
  const [exact] = useRoute(href);
  const [nested] = useRoute(`${href}/*?`);
  const active = href === '/' ? exact : exact || nested;

  return (
    <Link href={href} {...(active ? { 'aria-current': 'page' as const } : {})}>
      {label}
    </Link>
  );
}

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Primary">
      <TabLink href="/" label={t('nav.today')} />
      <TabLink href="/supplies" label={t('nav.supplies')} />
      <TabLink href="/plan" label={t('nav.plan')} />
      <TabLink href="/skills" label={t('nav.skills')} />
      <TabLink href="/settings" label={t('nav.settings')} />
    </nav>
  );
}

/**
 * Routes through the View Transitions API, with a shared-element morph where
 * the clicked element declares one via `data-vt-hero`.
 *
 * Intercepted in the capture phase so this runs before wouter's own handler;
 * without the stopPropagation the navigation would happen twice.
 */
/**
 * The deployment prefix, without its trailing slash: empty at a domain root,
 * `/Griddowneyesup` on a GitHub Pages project site.
 *
 * Routes are written root-relative throughout the app. The router adds this
 * prefix when it renders an href and strips it when it matches a location, so
 * only code that touches a raw DOM href has to know about it.
 */
const ROUTE_BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** A rendered href back to the root-relative path the router expects. */
function toRoutePath(href: string): string {
  if (!ROUTE_BASE) return href;
  if (href === ROUTE_BASE) return '/';
  return href.startsWith(`${ROUTE_BASE}/`) ? href.slice(ROUTE_BASE.length) : href;
}

function useTransitionalNavigation() {
  const [, navigate] = useLocation();

  const onClick = useCallback(
    (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href?.startsWith('/')) return;

      event.preventDefault();
      event.stopPropagation();

      const hero = anchor.querySelector<HTMLElement>('[data-vt-hero]');
      const path = toRoutePath(href);
      navigateWithTransition(() => {
        navigate(path);
        window.scrollTo(0, 0);
      }, hero);
    },
    [navigate],
  );

  useEffect(() => {
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [onClick]);
}

function Routes() {
  useTransitionalNavigation();

  return (
    <Switch>
      <Route path="/" component={Today} />
      <Route path="/supplies" component={Supplies} />
      <Route path="/plan" component={Plan} />
      <Route path="/skills" component={Skills} />
      <Route path="/skills/:id" component={SkillDetail} />
      <Route path="/settings" component={Settings} />
      <Route>
        <h1>Not found</h1>
        <p className="lede">That page does not exist. Everything else still works.</p>
      </Route>
    </Switch>
  );
}

/**
 * Print routes render without the app's chrome.
 *
 * A printable sheet is a different document, not a page of the app wearing a
 * print stylesheet: no tab bar, no status bar, no readiness theming, white
 * paper. Kept as its own branch so nothing in the shell can leak onto paper.
 */
function PrintShell() {
  useTransitionalNavigation();
  return (
    <Switch>
      <Route path="/print/:doc/:id?" component={PrintView} />
    </Switch>
  );
}

export function App() {
  return (
    <Router base={ROUTE_BASE}>
      <Shell />
    </Router>
  );
}

function Shell() {
  const [location] = useLocation();

  if (location.startsWith('/print/')) {
    return (
      <ContentProvider>
        <PrintShell />
      </ContentProvider>
    );
  }

  return (
    <ReadinessProvider>
      <ContentProvider>
        <div className="shell sheet">
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          {/* Menu first, then the readiness line, both sticking as one
              block. The nav used to be fixed to the bottom edge — the phone
              convention — but it is the thing a reader reaches for most and
              putting it where the page starts means it is in the same place
              whatever the page is doing. The status line sits under it because
              it describes the page below, not the menu above. */}
          <header className="topbar">
            <TabBar />
            <StatusBar />
          </header>
          <main className="main" id="main">
            <Routes />
          </main>
        </div>
      </ContentProvider>
    </ReadinessProvider>
  );
}

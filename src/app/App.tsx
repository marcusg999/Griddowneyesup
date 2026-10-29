import { useCallback, useEffect } from 'react';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import { ContentProvider } from '@/state/content';
import { ReadinessProvider, useReadiness } from '@/state/readiness';
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
      {/* Offline is a labelled, normal state. Never a spinner, never an error. */}
      <span className="statusbar__sync">{t('sync.neverSynced')}</span>
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
      navigateWithTransition(() => {
        navigate(href);
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
          <StatusBar />
          <main className="main" id="main">
            <Routes />
          </main>
          <TabBar />
        </div>
      </ContentProvider>
    </ReadinessProvider>
  );
}

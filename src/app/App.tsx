import { Link, Route, Switch, useRoute } from 'wouter';
import { ContentProvider } from '@/state/content';
import { ReadinessProvider, useReadiness } from '@/state/readiness';
import { t } from '@/i18n';
import { Today } from './pages/Today';
import { Supplies } from './pages/Supplies';
import { Plan } from './pages/Plan';
import { Skills } from './pages/Skills';
import { SkillDetail } from './pages/SkillDetail';
import { Settings } from './pages/Settings';

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
      {/*
        Never a spinner and never an error. Offline is a normal state and is
        labelled as one — everything on screen still works (§2).
      */}
      <span className="statusbar__sync">{t('sync.neverSynced')}</span>
    </div>
  );
}

function TabBar() {
  const tabs = [
    { href: '/', label: t('nav.today') },
    { href: '/supplies', label: t('nav.supplies') },
    { href: '/plan', label: t('nav.plan') },
    { href: '/skills', label: t('nav.skills') },
    { href: '/settings', label: t('nav.settings') },
  ];

  return (
    <nav className="tabbar" aria-label="Primary">
      {tabs.map((tab) => (
        <TabLink key={tab.href} href={tab.href} label={tab.label} />
      ))}
    </nav>
  );
}

function TabLink({ href, label }: { href: string; label: string }) {
  // Exact match for Today; prefix match elsewhere so detail routes stay lit.
  const [exact] = useRoute(href);
  const [nested] = useRoute(`${href}/*?`);
  const active = href === '/' ? exact : exact || nested;

  return (
    <Link href={href} {...(active ? { 'aria-current': 'page' as const } : {})}>
      {label}
    </Link>
  );
}

export function App() {
  return (
    <ReadinessProvider>
      <ContentProvider>
        <div className="shell">
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <StatusBar />
          <main className="main" id="main">
            <Switch>
              <Route path="/" component={Today} />
              <Route path="/supplies" component={Supplies} />
              <Route path="/plan" component={Plan} />
              <Route path="/skills" component={Skills} />
              <Route path="/skills/:id" component={SkillDetail} />
              <Route path="/settings" component={Settings} />
              <Route>
                <h1>Not found</h1>
                <p className="lede">
                  That page does not exist. Everything else still works.
                </p>
              </Route>
            </Switch>
          </main>
          <TabBar />
        </div>
      </ContentProvider>
    </ReadinessProvider>
  );
}

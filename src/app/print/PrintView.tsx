import { Link, useRoute } from 'wouter';
import { brand } from '@/config/brand';
import { store } from '@/db';
import { useContent } from '@/state/content';
import { usePlan } from '@/features/plan/usePlan';
import { useSupply } from '@/features/supply/useSupply';
import { wholeDays } from '@/features/supply/coverage';
import type { Contact, Plan } from '@/features/plan/types';

/**
 * Printable documents. §7.
 *
 * Deliberately not a bundled PDF renderer. The browser's own print pipeline
 * produces selectable, searchable, screen-reader-readable text at the user's
 * paper size, needs no JavaScript on the render path, adds nothing to a budget
 * aimed at a five-year-old Android, and offers "Save as PDF" on every platform
 * this ships to. A bundled renderer would cost 100 KB+ to produce a worse
 * document. The goal in §7 is ink on paper, not a file.
 *
 * Reasoning recorded in docs/ARCHITECTURE.md §12.
 */

const today = () => new Date().toISOString().slice(0, 10);

/** An empty field prints as a ruled blank so the sheet is usable with a pen. */
function Value({ children }: { children: string | undefined | null }) {
  const text = (children ?? '').trim();
  return text ? <>{text}</> : <span className="blankline" aria-label="blank" />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rowline">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Head({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="sheet-head">
      <h1>{title}</h1>
      <small>
        {subtitle} · {today()}
      </small>
    </div>
  );
}

function Foot({ note }: { note: string }) {
  return (
    <div className="sheet-foot">
      <span>{note}</span>
      <span>
        {brand.name} · printed {today()} · review every 6 months
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlanSheet() {
  const { plan, contacts, profile, completeness, loading } = usePlan();
  if (loading) return <p>Loading…</p>;

  const relay =
    contacts.find((c) => c.id === plan.outOfAreaContactId) ??
    contacts.find((c) => c.outOfArea);

  return (
    <div className="sheet-paper">
      <Head title="Household Emergency Plan" subtitle="Keep with your documents" />

      {/* A printed plan with blanks in it is worse than no printed plan,
          because it looks finished. Say so on the sheet. */}
      {!completeness.usable && (
        <div className="sheet-warn">
          <strong>Incomplete</strong> — {completeness.criticalGaps.length} critical{' '}
          {completeness.criticalGaps.length === 1 ? 'section is' : 'sections are'} still
          blank: {completeness.criticalGaps.map((s) => s.title).join(', ')}. The ruled
          blanks below can be filled in by hand.
        </div>
      )}

      <section className="sheet-section">
        <h2>Rally points</h2>
        <dl>
          <Row label="Primary">
            <Value>{plan.rallyPrimary?.where}</Value>
          </Row>
          <Row label="Secondary">
            <Value>{plan.rallySecondary?.where}</Value>
          </Row>
          <Row label="Out of area">
            <Value>{plan.rallyOutOfArea?.where}</Value>
          </Row>
        </dl>
      </section>

      <section className="sheet-section">
        <h2>Contacts</h2>
        <dl>
          <Row label="Out-of-area relay">
            <Value>{relay ? `${relay.name} — ${relay.phone ?? ''}` : undefined}</Value>
          </Row>
          {contacts
            .filter((c) => c.id !== relay?.id)
            .map((c) => (
              <Row key={c.id} label={c.relationship || 'Contact'}>
                {c.name} — <Value>{c.phone}</Value>
              </Row>
            ))}
          {contacts.length === 0 && (
            <>
              <Row label="Contact">
                <Value>{undefined}</Value>
              </Row>
              <Row label="Contact">
                <Value>{undefined}</Value>
              </Row>
            </>
          )}
        </dl>
      </section>

      <section className="sheet-section">
        <h2>Evacuation routes</h2>
        <dl>
          {plan.routes.map((r, i) => (
            <Row key={i} label={r.label}>
              {r.direction ? `${r.direction} · ` : ''}
              {r.via}
            </Row>
          ))}
          {plan.routes.length === 0 && (
            <>
              <Row label="Primary">
                <Value>{undefined}</Value>
              </Row>
              <Row label="Alternate">
                <Value>{undefined}</Value>
              </Row>
            </>
          )}
        </dl>
      </section>

      <section className="sheet-section">
        <h2>Utility shutoffs</h2>
        <dl>
          <Row label="Gas">
            <Value>{plan.gas?.location}</Value>
            {plan.gas?.tool && <em> — {plan.gas.tool}</em>}
          </Row>
          <Row label="Water">
            <Value>{plan.water?.location}</Value>
            {plan.water?.tool && <em> — {plan.water.tool}</em>}
          </Row>
          <Row label="Electrical">
            <Value>{plan.electric?.location}</Value>
          </Row>
        </dl>
        <p style={{ fontSize: '9.5pt', marginTop: '2mm' }}>
          Shut gas off only if you smell it, hear it, or are told to. Turning it back on
          is a utility job. Never stand in water to reach the panel.
        </p>
      </section>

      <section className="sheet-section">
        <h2>Shelter in place</h2>
        <dl>
          <Row label="Room">
            <Value>{plan.shelterRoom}</Value>
          </Row>
          <Row label="Procedure">
            <Value>{plan.shelterNotes}</Value>
          </Row>
        </dl>
      </section>

      {(plan.petPlan || plan.schoolPlan || plan.mobilityPlan) && (
        <section className="sheet-section">
          <h2>Dependents</h2>
          <dl>
            {plan.petPlan && <Row label="Pets">{plan.petPlan}</Row>}
            {plan.schoolPlan && <Row label="Children">{plan.schoolPlan}</Row>}
            {plan.mobilityPlan && <Row label="Mobility">{plan.mobilityPlan}</Row>}
          </dl>
        </section>
      )}

      <section className="sheet-section">
        <h2>Check-in</h2>
        <dl>
          <Row label="All is well">
            <Value>{plan.checkInPhrase}</Value>
          </Row>
          <Row label="Something is wrong">
            <Value>{plan.duressPhrase}</Value>
          </Row>
          <Row label="How often">
            <Value>{plan.checkInCadence}</Value>
          </Row>
        </dl>
      </section>

      <section className="sheet-section">
        <h2>Household</h2>
        <dl>
          <Row label="People">
            {(profile?.members ?? []).map((m) => m.label).join(', ') || <Value>{undefined}</Value>}
          </Row>
          <Row label="Target horizon">{profile?.targetHorizonDays ?? 3} days</Row>
        </dl>
      </section>

      <Foot note="In a wide-area event, assume you are your own first responder for 72+ hours." />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RallyCardFace({ plan, relay }: { plan: Plan; relay: Contact | undefined }) {
  return (
    <div className="card-cut">
      <h3>Rally points & relay</h3>
      <dl>
        <Row label="Primary">
          <Value>{plan.rallyPrimary?.where}</Value>
        </Row>
        <Row label="Secondary">
          <Value>{plan.rallySecondary?.where}</Value>
        </Row>
        <Row label="Out of area">
          <Value>{plan.rallyOutOfArea?.where}</Value>
        </Row>
        <Row label="Relay">
          <Value>{relay ? `${relay.name} ${relay.phone ?? ''}` : undefined}</Value>
        </Row>
      </dl>
      <div className="card-foot">
        If you cannot reach each other, go to the next point down this list and wait.
      </div>
    </div>
  );
}

function RallyCardSheet() {
  const { plan, contacts, loading } = usePlan();
  if (loading) return <p>Loading…</p>;
  const relay =
    contacts.find((c) => c.id === plan.outOfAreaContactId) ??
    contacts.find((c) => c.outOfArea);

  return (
    <div className="sheet-paper">
      <Head title="Rally Card" subtitle="Cut out · one per person" />
      <p style={{ fontSize: '10pt' }}>
        Bank-card sized, so it fits a wallet or a phone case. Print one for every person
        in the household, including the ones who think they will remember.
      </p>
      <div className="cards">
        {/* Four to a sheet: a household is rarely one person, and the card is
            no use if only the person who printed it is carrying one. */}
        <RallyCardFace plan={plan} relay={relay} />
        <RallyCardFace plan={plan} relay={relay} />
        <RallyCardFace plan={plan} relay={relay} />
        <RallyCardFace plan={plan} relay={relay} />
      </div>
      <Foot note="Cut along the dashed lines." />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ContactSheet() {
  const { contacts, plan, loading } = usePlan();
  if (loading) return <p>Loading…</p>;
  const relay =
    contacts.find((c) => c.id === plan.outOfAreaContactId) ??
    contacts.find((c) => c.outOfArea);

  return (
    <div className="sheet-paper">
      <Head title="Contact Card" subtitle="Keep in a wallet or a bag" />

      <section className="sheet-section">
        <h2>Your people</h2>
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Relationship</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  {c.id === relay?.id ? ' (relay)' : ''}
                </td>
                <td>{c.relationship || '—'}</td>
                <td>
                  <Value>{c.phone}</Value>
                </td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 6 - contacts.length) }).map((_, i) => (
              <tr key={`blank-${i}`}>
                <td>
                  <Value>{undefined}</Value>
                </td>
                <td>
                  <Value>{undefined}</Value>
                </td>
                <td>
                  <Value>{undefined}</Value>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sheet-section">
        <h2>Public numbers</h2>
        <p style={{ fontSize: '10pt' }}>
          Fill these in now, from your own county's website, while you can load it.
          Response in a wide-area event is overwhelmed and delayed — these numbers are
          worth having and are not a substitute for your own plan.
        </p>
        <dl>
          <Row label="Emergency">911 (US)</Row>
          <Row label="Poison control">1-800-222-1222 (US)</Row>
          <Row label="Utility — power out">
            <Value>{undefined}</Value>
          </Row>
          <Row label="Utility — gas leak">
            <Value>{undefined}</Value>
          </Row>
          <Row label="Water department">
            <Value>{undefined}</Value>
          </Row>
          <Row label="Nearest hospital">
            <Value>{undefined}</Value>
          </Row>
          <Row label="Pharmacy">
            <Value>{undefined}</Value>
          </Row>
          <Row label="Local shelter">
            <Value>{undefined}</Value>
          </Row>
        </dl>
      </section>

      <Foot note="You are your own first responder for the first 72 hours." />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChecklistSheet() {
  const { pack } = useContent();
  const { inventory, coverage, loading } = useSupply();
  if (loading || !pack) return <p>Loading…</p>;

  const held = new Map(inventory.map((r) => [r.itemId, r.quantity]));
  const measured = coverage.filter((c) => c.dailyNeed > 0);

  return (
    <div className="sheet-paper">
      <Head title="Supply Checklist" subtitle="Tick as you go" />

      <section className="sheet-section">
        <h2>Covered for</h2>
        <dl>
          {measured.map((row) => (
            <Row key={row.resource} label={row.resource.split('-')[0] ?? row.resource}>
              {wholeDays(row.days)} days
            </Row>
          ))}
        </dl>
      </section>

      {pack.kits
        .slice()
        .sort((a, b) => a.rung - b.rung)
        .map((kit) => (
          <section className="sheet-section" key={kit.id}>
            <h2>
              {kit.name} — {kit.horizon}
            </h2>
            <table className="sheet-table">
              <tbody>
                {kit.baseItems.map((id) => {
                  const item = pack.items.find((i) => i.id === id);
                  const have = held.get(id) ?? 0;
                  return (
                    <tr key={id}>
                      <td style={{ width: '6mm' }}>
                        <span className="checkbox-cell" aria-hidden="true" />
                      </td>
                      <td>
                        {item?.name ?? id}
                        {kit.criticalItems.includes(id) && <strong> — critical</strong>}
                        <br />
                        <span style={{ fontSize: '9pt' }}>{item?.spec}</span>
                      </td>
                      <td className="num">{have > 0 ? `have ${have}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

      <Foot note="Specifications, not brands. Buy on spec and buy the cheapest thing that meets it." />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SkillSheet({ id }: { id: string }) {
  const { pack } = useContent();
  const skill = pack?.skills.find((s) => s.id === id);
  if (!skill) return <p>Not in the library.</p>;

  return (
    <div className="sheet-paper">
      <Head title={skill.title} subtitle={`${skill.category} · ${skill.riskTier} risk`} />

      <p>{skill.summary}</p>

      {/* The limits print above the steps for the same reason they render
          above them on screen: after the steps is after someone has started. */}
      <div className="sheet-warn">
        <strong>What this does NOT do</strong>
        <ul style={{ margin: '2mm 0 0', paddingLeft: '5mm' }}>
          {skill.doesNotDo.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <section className="sheet-section">
        <h2>Steps</h2>
        <ol style={{ paddingLeft: '6mm', margin: 0 }}>
          {skill.steps.map((s) => (
            <li key={s.n} style={{ marginBottom: '2mm' }}>
              {s.text}
              {s.caution && (
                <>
                  <br />
                  <strong>Caution: {s.caution}</strong>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>

      {skill.failureModes.length > 0 && (
        <section className="sheet-section">
          <h2>What usually goes wrong</h2>
          <table className="sheet-table">
            <tbody>
              {skill.failureModes.map((m) => (
                <tr key={m.symptom}>
                  <td>
                    <strong>{m.symptom}</strong>
                    <br />
                    <span style={{ fontSize: '9.5pt' }}>
                      {m.cause} → {m.remedy}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Foot
        note={`Sources: ${skill.citations.map((c) => c.source).join(', ')} · reviewed ${skill.lastReviewed}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

const TITLES: Record<string, string> = {
  plan: 'Household plan',
  'rally-card': 'Rally card',
  contacts: 'Contact card',
  checklist: 'Supply checklist',
};

export function PrintView() {
  const [, params] = useRoute('/print/:doc/:id?');
  const doc = params?.doc ?? 'plan';

  return (
    <div className="printview">
      <div className="printbar">
        <Link href="/plan">← Back</Link>
        <strong>{TITLES[doc] ?? 'Skill sheet'}</strong>
        <button
          type="button"
          className="btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            // Awarded on the print itself, not on viewing the page: looking
            // at a plan is not the same as having one on paper.
            void store.achievements.award('paper-trail', doc);
            window.print();
          }}
        >
          Print / Save as PDF
        </button>
      </div>

      {doc === 'plan' && <PlanSheet />}
      {doc === 'rally-card' && <RallyCardSheet />}
      {doc === 'contacts' && <ContactSheet />}
      {doc === 'checklist' && <ChecklistSheet />}
      {doc === 'skill' && params?.id && <SkillSheet id={params.id} />}
    </div>
  );
}

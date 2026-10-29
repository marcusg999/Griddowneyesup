import { useState } from 'react';
import { Link } from 'wouter';
import { t } from '@/i18n';
import { Field } from '@/ui/Field';
import { usePlan } from '@/features/plan/usePlan';
import type { Contact, EvacRoute, Shutoff } from '@/features/plan/types';

/**
 * The plan builder. §4.4.
 *
 * One scrolling page, not a wizard. Plans get built in fragments over weeks —
 * a wizard that loses your place, or that demands you finish in one sitting,
 * is a wizard nobody finishes. Everything autosaves to IndexedDB on blur.
 */
export function Plan() {
  const { plan, contacts, profile, loading, patch, saveContact, removeContact, completeness } =
    usePlan();

  if (loading) return <p className="lede">Opening your plan…</p>;

  const section = (id: string) => completeness.sections.find((s) => s.id === id);

  return (
    <>
      <p className="kicker">
        Household · {completeness.doneCount} of {completeness.total} sections
      </p>
      <h1>{t('nav.plan')}</h1>
      <p className="lede">
        Fifteen minutes, once, mostly. Nothing here is sent anywhere — it stays on this
        device.
      </p>

      {completeness.usable ? (
        <div className="verdict verdict--ok">
          <strong>Usable</strong>
          Every critical section is filled in. Print it — the most likely failure in an
          emergency is a dead phone, and this app is on a phone.
        </div>
      ) : (
        <div className="verdict">
          <strong>
            {completeness.criticalGaps.length} critical{' '}
            {completeness.criticalGaps.length === 1 ? 'section' : 'sections'} to go
          </strong>
          {completeness.criticalGaps.map((s) => s.title).join(' · ')}
        </div>
      )}

      <p className="print-row">
        <Link href="/print/plan" className="btn">
          Print the plan
        </Link>
        <Link href="/print/rally-card" className="btn btn--ghost">
          Wallet card
        </Link>
        <Link href="/print/contacts" className="btn btn--ghost">
          Contact card
        </Link>
      </p>

      {/* --- Rally points ---------------------------------------------- */}
      <Block state={section('rally')} note="where to go">
        <Field
          label="Primary — near home"
          value={plan.rallyPrimary?.where}
          placeholder="The oak at the end of the driveway"
          onCommit={(where) => void patch({ rallyPrimary: { ...plan.rallyPrimary, where } })}
          hint="Close enough to walk to, visible, and somewhere you can stand for an hour."
        />
        <Field
          label="Secondary — outside the neighbourhood"
          value={plan.rallySecondary?.where}
          placeholder="The library car park on Mill Street"
          onCommit={(where) =>
            void patch({ rallySecondary: { ...plan.rallySecondary, where } })
          }
          hint="For when the street itself is the problem."
        />
        <Field
          label="Out of area"
          value={plan.rallyOutOfArea?.where}
          placeholder="Aunt Ruth's, 2 hours north"
          onCommit={(where) =>
            void patch({ rallyOutOfArea: { ...plan.rallyOutOfArea, where } })
          }
          hint="For when the region is evacuated. Tell them they are on the plan."
        />
      </Block>

      {/* --- Contacts --------------------------------------------------- */}
      <Block state={section('contacts')} note="who to call">
        <ContactList
          contacts={contacts}
          onSave={saveContact}
          onRemove={removeContact}
          outOfAreaId={plan.outOfAreaContactId}
          onDesignate={(id) => void patch({ outOfAreaContactId: id })}
        />
      </Block>

      {/* --- Routes ----------------------------------------------------- */}
      <Block state={section('routes')} note="ways out">
        <RouteList
          routes={plan.routes}
          onChange={(routes) => void patch({ routes })}
        />
      </Block>

      {/* --- Shelter ---------------------------------------------------- */}
      <Block state={section('shelter')} note="staying put">
        <Field
          label="Which room"
          value={plan.shelterRoom}
          placeholder="Interior bathroom, no windows"
          onCommit={(shelterRoom) => void patch({ shelterRoom })}
          hint="Interior, lowest floor for wind, highest for flood. Pick for your hazard."
        />
        <Field
          label="What you do to it"
          value={plan.shelterNotes}
          multiline
          placeholder="Close the dampers, tape the window gap, bring the radio and the water"
          onCommit={(shelterNotes) => void patch({ shelterNotes })}
        />
      </Block>

      {/* --- Utilities -------------------------------------------------- */}
      <Block state={section('utilities')} note="shutoffs">
        <ShutoffFields
          label="Gas"
          value={plan.gas}
          onCommit={(gas) => void patch({ gas })}
          hint="Only shut gas off if you smell it, hear it, or are told to. Turning it back on is a utility job."
        />
        <ShutoffFields
          label="Water"
          value={plan.water}
          onCommit={(water) => void patch({ water })}
          hint="Shutting the main also protects the water already in your pipes and tank."
        />
        <ShutoffFields
          label="Electrical"
          value={plan.electric}
          onCommit={(electric) => void patch({ electric })}
          hint="Main breaker. Never stand in water to reach it."
        />
      </Block>

      {/* --- Dependents ------------------------------------------------- */}
      {(section('dependents')?.critical ?? false) && (
        <Block state={section('dependents')} note="who needs help">
          {(profile?.pets ?? 0) > 0 && (
            <Field
              label="Pets"
              value={plan.petPlan}
              multiline
              placeholder="Carrier by the back door. Most shelters will not take animals — the motel on Route 9 does."
              onCommit={(petPlan) => void patch({ petPlan })}
            />
          )}
          <Field
            label="Children / school"
            value={plan.schoolPlan}
            multiline
            placeholder="School holds until collected. Authorised: Ruth, Dan. School will not release to anyone else."
            onCommit={(schoolPlan) => void patch({ schoolPlan })}
          />
          <Field
            label="Mobility and medical"
            value={plan.mobilityPlan}
            multiline
            placeholder="Mum cannot do stairs. Oxygen concentrator needs mains — 4 hours on the backup."
            onCommit={(mobilityPlan) => void patch({ mobilityPlan })}
          />
        </Block>
      )}

      {/* --- Documents -------------------------------------------------- */}
      <Block state={section('documents')} note="paperwork">
        <ul className="doclist">
          {plan.documents.map((doc) => (
            <li key={doc.id}>
              <label>
                <input
                  type="checkbox"
                  checked={doc.copied}
                  onChange={(e) =>
                    void patch({
                      documents: plan.documents.map((d) =>
                        d.id === doc.id ? { ...d, copied: e.target.checked } : d,
                      ),
                    })
                  }
                />
                <span>{doc.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="meta">
          A copy in the document pouch and a copy with your out-of-area contact. Replacing
          these afterwards is months of your life.
        </p>
      </Block>

      {/* --- Check-in --------------------------------------------------- */}
      <Block state={section('checkin')} note="words">
        <Field
          label="Check-in phrase"
          value={plan.checkInPhrase}
          placeholder="Feeding the cat"
          onCommit={(checkInPhrase) => void patch({ checkInPhrase })}
          hint="Means: I am where I should be and I am fine."
        />
        <Field
          label="Duress phrase"
          value={plan.duressPhrase}
          placeholder="Did you water the ferns?"
          onCommit={(duressPhrase) => void patch({ duressPhrase })}
          hint={
            <>
              Means: something is wrong and I cannot say so. Agreed in advance because
              under stress people say they are fine by reflex, and because a phrase can be
              said in front of someone. Tell your people what to do when they hear it.
            </>
          }
        />
        <Field
          label="How often you check in"
          value={plan.checkInCadence}
          placeholder="Every 4 hours, or at each rally point"
          onCommit={(checkInCadence) => void patch({ checkInCadence })}
        />
      </Block>

      <h2>
        <span className="margin-note" aria-hidden="true">
          on paper
        </span>
        Print it
      </h2>
      <p>
        An app that knows it might not be there is more trustworthy than one that assumes
        it will be. All four sheets are black and white and legible at arm's length.
      </p>
      <p className="print-row">
        <Link href="/print/plan" className="btn">
          Household plan
        </Link>
        <Link href="/print/rally-card" className="btn btn--ghost">
          Rally card
        </Link>
        <Link href="/print/contacts" className="btn btn--ghost">
          Contact card
        </Link>
        <Link href="/print/checklist" className="btn btn--ghost">
          Supply checklist
        </Link>
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function Block({
  state,
  note,
  children,
}: {
  state: { title: string; why: string; done: boolean; missing: readonly string[] } | undefined;
  note: string;
  children: React.ReactNode;
}) {
  if (!state) return null;
  return (
    <section className="planblock reveal">
      <h2>
        <span className="margin-note" aria-hidden="true">
          {note}
        </span>
        {state.title}
        {state.done && (
          <span className="pill pill--acid" style={{ marginLeft: 10, verticalAlign: 'middle' }}>
            done
          </span>
        )}
      </h2>
      <p className="meta" style={{ marginTop: -6 }}>
        {state.why}
      </p>
      {children}
      {state.missing.length > 0 && (
        <p className="meta planblock__missing">Still blank: {state.missing.join(', ')}</p>
      )}
    </section>
  );
}

function ShutoffFields({
  label,
  value,
  onCommit,
  hint,
}: {
  label: string;
  value: Shutoff | undefined;
  onCommit: (next: Shutoff) => void;
  hint: string;
}) {
  return (
    <div className="shutoff">
      <Field
        label={`${label} — where it is`}
        value={value?.location}
        placeholder="Side of the house, behind the bins"
        onCommit={(location) => onCommit({ ...value, location })}
        hint={hint}
      />
      <Field
        label={`${label} — tool, and where the tool lives`}
        value={value?.tool}
        placeholder="Four-way meter key, zip-tied to the pipe"
        onCommit={(tool) => onCommit({ location: value?.location ?? '', ...value, tool })}
      />
    </div>
  );
}

function RouteList({
  routes,
  onChange,
}: {
  routes: readonly EvacRoute[];
  onChange: (next: EvacRoute[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [via, setVia] = useState('');
  const [direction, setDirection] = useState('');

  return (
    <>
      {routes.map((route, i) => (
        <div className="card" key={`${route.label}-${i}`}>
          <strong>{route.label}</strong>
          {route.direction && <span className="pill" style={{ marginLeft: 8 }}>{route.direction}</span>}
          <p className="meta" style={{ margin: '5px 0 0' }}>
            {route.via}
          </p>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ minHeight: 36, padding: '4px 12px', marginTop: 8 }}
            onClick={() => onChange(routes.filter((_, n) => n !== i))}
            aria-label={`Remove ${route.label}`}
          >
            Remove
          </button>
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || !via.trim()) return;
          onChange([...routes, { label: label.trim(), via: via.trim(), direction: direction.trim() }]);
          setLabel('');
          setVia('');
          setDirection('');
        }}
      >
        <Field label="Route name" value={label} onCommit={setLabel} placeholder="Primary — north" />
        <Field label="Direction" value={direction} onCommit={setDirection} placeholder="N" />
        <Field
          label="Via which roads"
          value={via}
          onCommit={setVia}
          placeholder="Mill St → Route 9 → I-84 north"
        />
        <button className="btn" type="submit">
          Add route
        </button>
      </form>
      <p className="meta">
        The obvious road out is the one everyone else takes. Write down at least two, and
        drive the alternate once so you know it is real.
      </p>
    </>
  );
}

function ContactList({
  contacts,
  onSave,
  onRemove,
  outOfAreaId,
  onDesignate,
}: {
  contacts: readonly Contact[];
  onSave: (c: Contact) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  outOfAreaId: string | undefined;
  onDesignate: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [outOfArea, setOutOfArea] = useState(false);

  return (
    <>
      {contacts.map((contact) => (
        <div className="card" key={contact.id} data-testid="contact-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong>{contact.name}</strong>
            {contact.outOfArea && <span className="pill pill--acid">out of area</span>}
            {outOfAreaId === contact.id && <span className="pill">relay</span>}
          </div>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            {[contact.relationship, contact.phone].filter(Boolean).join(' · ') || 'No number'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {contact.outOfArea && outOfAreaId !== contact.id && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ minHeight: 36, padding: '4px 12px' }}
                onClick={() => onDesignate(contact.id)}
              >
                Make relay
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              style={{ minHeight: 36, padding: '4px 12px' }}
              onClick={() => void onRemove(contact.id)}
              aria-label={`Remove ${contact.name}`}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void onSave({
            id: `c-${Date.now()}`,
            name: name.trim(),
            phone: phone.trim(),
            relationship: relationship.trim(),
            outOfArea,
          });
          setName('');
          setPhone('');
          setRelationship('');
          setOutOfArea(false);
        }}
      >
        <Field label="Name" value={name} onCommit={setName} placeholder="Ruth Alvarez" />
        <Field label="Relationship" value={relationship} onCommit={setRelationship} placeholder="Sister" />
        <Field label="Phone" value={phone} onCommit={setPhone} type="tel" placeholder="+1 555 0137" />
        <p className="field">
          <label className="checkline">
            <input
              type="checkbox"
              checked={outOfArea}
              onChange={(e) => setOutOfArea(e.target.checked)}
            />
            <span>Lives outside this region</span>
          </label>
        </p>
        <button className="btn" type="submit">
          Add contact
        </button>
      </form>
      <p className="meta">
        The out-of-area contact is the one everyone forgets. In a local event local lines
        jam and local people are busy; someone two states away can take calls from people
        who cannot reach each other.
      </p>
    </>
  );
}

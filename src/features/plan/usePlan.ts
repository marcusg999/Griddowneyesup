import { useCallback, useEffect, useState } from 'react';
import { store } from '@/db';
import type { Profile } from '@/db/types';
import { DEFAULT_DOCUMENTS, EMPTY_PLAN, type Contact, type Plan } from './types';
import { planCompleteness, type PlanCompleteness } from './completeness';

/**
 * Plan state.
 *
 * Writes straight through to IndexedDB on every change. A plan builder that
 * loses a half-finished plan because the tab closed is a plan builder nobody
 * finishes — and there is no server to lose it to anyway.
 */
export function usePlan() {
  const [plan, setPlan] = useState<Plan>(EMPTY_PLAN);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profile, setProfile] = useState<Profile | undefined>();
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [saved, savedContacts, savedProfile] = await Promise.all([
      store.plan.get(),
      store.contacts.all(),
      store.profile.get(),
    ]);
    setPlan(
      saved ?? { ...EMPTY_PLAN, documents: DEFAULT_DOCUMENTS.map((d) => ({ ...d })) },
    );
    setContacts(savedContacts);
    setProfile(savedProfile);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback(
    async (changes: Partial<Plan>) => {
      const next: Plan = { ...plan, ...changes };
      setPlan(next);
      await store.plan.put(next);
    },
    [plan],
  );

  const saveContact = useCallback(
    async (contact: Contact) => {
      await store.contacts.put(contact);
      setContacts(await store.contacts.all());
    },
    [],
  );

  const removeContact = useCallback(async (id: string) => {
    await store.contacts.remove(id);
    setContacts(await store.contacts.all());
  }, []);

  const completeness: PlanCompleteness = planCompleteness(plan, contacts, profile);

  return { plan, contacts, profile, loading, patch, saveContact, removeContact, completeness, reload };
}

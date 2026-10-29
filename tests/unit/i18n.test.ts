import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';

describe('message interpolation', () => {
  it('substitutes named values', () => {
    expect(t('skill.timeRequired', { minutes: 20 })).toBe('20 min');
  });

  it('picks the singular form', () => {
    // "1 critical items missing" shipped once. It does not ship again.
    expect(t('kit.criticalMissing', { n: 1 })).toBe('1 critical item missing');
    expect(t('coverage.days', { n: 1 })).toBe('1 day');
  });

  it('picks the plural form', () => {
    expect(t('kit.criticalMissing', { n: 4 })).toBe('4 critical items missing');
    expect(t('coverage.days', { n: 0 })).toBe('0 days');
    expect(t('coverage.days', { n: 11 })).toBe('11 days');
  });

  it('leaves unknown placeholders alone rather than printing undefined', () => {
    expect(t('weight.overBudget', {})).toContain('{amount}');
  });
});

import { messages, type MessageKey } from './messages.en-US';

/**
 * Minimal i18n layer.
 *
 * Deliberately not a library. The §8 performance budget is tight and the
 * feature set needed here is small: key lookup, named interpolation, and a
 * plural form. Swapping in a full ICU runtime later is a change behind this
 * interface, not a change at every call site.
 */

export type Locale = 'en-US';

let activeLocale: Locale = 'en-US';

const catalogues: Record<Locale, Record<string, string>> = {
  'en-US': messages,
};

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getLocale(): Locale {
  return activeLocale;
}

type Values = Record<string, string | number>;

/**
 * Resolves `{name}` placeholders, and the one plural form the catalogue uses:
 * `{n, plural, one {# day} other {# days}}`.
 */
function interpolate(template: string, values: Values, locale: Locale): string {
  const withPlurals = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
    (_match, name: string, one: string, other: string) => {
      const raw = values[name];
      const n = typeof raw === 'number' ? raw : Number(raw ?? 0);
      const rule = new Intl.PluralRules(locale).select(n);
      const chosen = rule === 'one' ? one : other;
      return chosen.replace(/#/g, new Intl.NumberFormat(locale).format(n));
    },
  );

  return withPlurals.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    if (value === undefined) return match;
    return typeof value === 'number'
      ? new Intl.NumberFormat(locale).format(value)
      : value;
  });
}

export function t(key: MessageKey, values?: Values): string {
  const template = catalogues[activeLocale][key];
  if (template === undefined) {
    // A missing key is a bug, not a runtime failure. Render the key so it is
    // visible in development and harmless in production.
    return key;
  }
  return values ? interpolate(template, values, activeLocale) : template;
}

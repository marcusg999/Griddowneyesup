import { useId, type ReactNode } from 'react';

/**
 * A labelled input that saves as you leave it.
 *
 * `defaultValue` plus onBlur rather than a controlled value: every keystroke
 * would otherwise be an IndexedDB write, and a controlled field re-rendering
 * the whole plan on each character makes typing feel laggy on the five-year-old
 * Android the budget targets.
 */
export function Field({
  label,
  hint,
  value,
  onCommit,
  placeholder,
  multiline,
  type = 'text',
}: {
  label: string;
  hint?: ReactNode;
  value: string | undefined;
  onCommit: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  const id = useId();
  const shared = {
    id,
    className: 'search',
    defaultValue: value ?? '',
    placeholder,
    onBlur: (e: { target: { value: string } }) => {
      const next = e.target.value.trim();
      if (next !== (value ?? '')) onCommit(next);
    },
  };

  return (
    <p className="field">
      <label className="meta" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} />
      ) : (
        <input {...shared} type={type} inputMode={type === 'tel' ? 'tel' : undefined} />
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </p>
  );
}

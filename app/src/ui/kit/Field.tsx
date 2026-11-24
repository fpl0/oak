// Form rows for settings-like pages: a label column, a control, and help text — all properly associated.
import { clsx } from "clsx";
import { type ReactNode, useId } from "react";

export function Section({
  title,
  children,
  description,
}: {
  title: string;
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-h3">{title}</h2>
      {description && <p className="mt-1 text-sm text-text-2">{description}</p>}
      <div className="mt-4 flex flex-col divide-y divide-border">{children}</div>
    </section>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: ReactNode;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const id = useId();
  const helpId = useId();
  return (
    <div className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[14rem_1fr] sm:items-center">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {help && (
          <p id={helpId} className="text-sm text-text-2">
            {help}
          </p>
        )}
      </div>
      <div className="min-w-0">{children({ id, describedBy: help ? helpId : undefined })}</div>
    </div>
  );
}

export function ReadOnlyRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[14rem_1fr] sm:items-center">
      <span className="font-medium">{label}</span>
      <span className="text-text-2">{value}</span>
    </div>
  );
}

export function Switch({
  id,
  checked,
  onChange,
  describedBy,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onChange(v: boolean): void;
  describedBy?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 reduced:transition-none",
        // Off: a text-3 outline and thumb (above 3:1 on the card in both themes, WCAG 1.4.11); the border token
        // and a surface-coloured thumb left an off switch nearly invisible on the card.
        checked ? "border-accent bg-accent" : "border-text-3 bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "inline-block size-4.5 rounded-full shadow transition-transform reduced:transition-none",
          checked ? "translate-x-[18px] bg-surface" : "translate-x-[3px] bg-text-3",
        )}
      />
    </button>
  );
}

export function Select<V extends string | number>({
  id,
  value,
  options,
  onChange,
  describedBy,
  disabled,
}: {
  id?: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange(v: V): void;
  describedBy?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      aria-describedby={describedBy}
      disabled={disabled}
      value={String(value)}
      onChange={(e) => {
        const hit = options.find((o) => String(o.value) === e.target.value);
        if (hit) onChange(hit.value);
      }}
      className="h-8 rounded-control border border-control-border bg-control px-2 text-text hover:bg-control-hover disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Slider({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  describedBy,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(v: number): void;
  format?: (v: number) => string;
  describedBy?: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={describedBy}
        aria-valuetext={format ? format(value) : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-56 accent-[var(--oak-accent)]"
      />
      <span className="w-14 text-sm text-text-2 tabular-nums">{format ? format(value) : value}</span>
    </div>
  );
}

/** Journal surface for settings-style pages (settings, account, more). */
export const SURFACE =
  "rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

/** A titled group of related settings, e.g. "You" or "This trip". */
export function SettingsGroup({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="scroll-mt-24 font-display text-2xl font-medium text-ink-900">
          {title}
        </h2>
        {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Small heading inside a group (one card's title). */
export function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[15px] font-medium text-ink-900">{children}</h3>;
}

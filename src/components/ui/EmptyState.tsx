export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-cream-300 bg-cream-100/60 px-6 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

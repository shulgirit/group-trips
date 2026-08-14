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
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-lemon-100 to-sea-100 text-3xl"
        aria-hidden
      >
        {emoji}
      </span>
      <h3 className="mt-4 font-display text-xl font-bold text-ink-900">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";

export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
}: {
  /** Lucide icon shown above the title. */
  icon?: LucideIcon;
  /** @deprecated Emoji no longer render in UI chrome — pass `icon`. Ignored. */
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {IconComponent && (
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full border border-cream-200 text-sea-700"
          aria-hidden
        >
          <IconComponent size={22} strokeWidth={STROKE} />
        </span>
      )}
      <h3 className="mt-5 font-display text-lg font-normal text-ink-900">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

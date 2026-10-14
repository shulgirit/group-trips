/**
 * Together — brand mark: two routes converging into one path, meeting at
 * a brass node. Strokes use currentColor so the mark follows its context.
 */

const BRASS = "#A8865A";

export function LogoMark({
  size = 32,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M9 6C9 19.5 24 21.5 24 30M39 6C39 19.5 24 21.5 24 30V43"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="30" r="3.3" fill={BRASS} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      dir="ltr"
      className={`font-mark font-light uppercase tracking-[0.24em] ${className}`}
    >
      Together
    </span>
  );
}

/** Horizontal lockup: mark + wordmark. */
export function Logo({
  size = 28,
  className = "",
  wordClassName = "text-[17px]",
}: {
  size?: number;
  className?: string;
  wordClassName?: string;
}) {
  return (
    <span dir="ltr" className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <Wordmark className={wordClassName} />
    </span>
  );
}

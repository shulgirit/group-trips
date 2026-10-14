/**
 * Together — brand mark: a T drawn as two routes that meet at a brass node
 * and continue as one path. Strokes use currentColor so the mark follows its context.
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
        d="M6 12C14 12 20 13.5 24 19M42 12C34 12 28 13.5 24 19V42"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="19" r="3.3" fill={BRASS} />
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

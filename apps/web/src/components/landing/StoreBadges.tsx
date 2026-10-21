/** Non-clickable "download" badges. Swap for real links once the apps are live. */
function Badge({ label, small, big, icon }: { label: string; small: string; big: string; icon: React.ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="pointer-events-none flex h-[52px] w-[156px] select-none items-center gap-2.5 rounded-xl border border-white/40 bg-black px-3 text-white"
      dir="ltr"
    >
      {icon}
      <span className="flex flex-col leading-none">
        <span className="text-[9px] tracking-wide opacity-90">{small}</span>
        <span className="mt-1 text-[17px] font-semibold tracking-tight">{big}</span>
      </span>
    </div>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`} dir="ltr">
      <Badge
        label="App Store"
        small="Download on the"
        big="App Store"
        icon={
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
            <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.600-2.800-1.800-3.400-1.800-1.400-.1-2.800.9-3.500.9s-1.800-.8-3-.8c-1.500 0-3 .9-3.800 2.300-1.600 2.800-.4 7 1.200 9.300.8 1.100 1.700 2.400 2.900 2.300 1.200 0 1.600-.7 3-.7s1.800.7 3 .7c1.300 0 2.100-1.100 2.800-2.200.9-1.300 1.300-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.900zM14.200 5.800c.6-.8 1.100-1.800.9-2.800-.9 0-2 .6-2.600 1.400-.6.700-1.100 1.700-.9 2.700 1 .1 2-.5 2.600-1.300z" />
          </svg>
        }
      />
      <Badge
        label="Google Play"
        small="GET IT ON"
        big="Google Play"
        icon={
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
            <path d="M3.600 2.300 13.400 12 3.600 21.700c-.3-.3-.4-.7-.4-1.200V3.500c0-.5.1-.9.400-1.200z" fill="#00d7fe" />
            <path d="m16.700 8.700-3.300 3.300 3.300 3.300 3.900-2.200c1.100-.6 1.100-1.600 0-2.200z" fill="#ffce00" />
            <path d="M13.400 12 3.600 2.300c.4-.3 1-.3 1.700.1l11.400 6.300z" fill="#00f076" />
            <path d="m13.400 12 3.300 3.300-11.400 6.300c-.7.400-1.300.400-1.700.1z" fill="#ff3a44" />
          </svg>
        }
      />
    </div>
  );
}

/**
 * Fallback artwork when a trip or place has no photo: two routes crossing
 * chart paper and meeting at a brass point — the brand mark as landscape.
 * Deterministic per seed, so the same trip always gets the same drawing.
 */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function RouteArt({
  seed,
  tone = "night",
  focus = "center",
  className = "",
}: {
  seed: string;
  tone?: "night" | "chart";
  /** "top" keeps the meeting point clear of text laid over the bottom */
  focus?: "center" | "top";
  className?: string;
}) {
  const h = hash(seed);
  const pick = (shift: number, min: number, max: number) =>
    min + (((h >>> shift) & 0xff) / 255) * (max - min);
  // meeting point and two origins
  const mx = pick(0, 52, 72);
  const my = focus === "top" ? pick(8, 16, 30) : pick(8, 38, 58);
  const ax = pick(16, 2, 18);
  const ay = pick(24, 12, 40);
  const bx = pick(4, 82, 98);
  const by = focus === "top" ? pick(12, 46, 60) : pick(12, 70, 92);
  const night = tone === "night";
  const ground = night ? "#0b1322" : "#e7eae4";
  const contour = night ? "rgb(143 183 177 / 0.09)" : "rgb(47 107 102 / 0.12)";
  const route = night ? "rgb(241 243 239 / 0.55)" : "rgb(15 27 45 / 0.45)";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    >
      <rect width="100" height="100" fill={ground} />
      {/* contour lines of an imagined coastline */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse
          key={i}
          cx={mx + 8}
          cy={my + 14}
          rx={18 + i * 11}
          ry={10 + i * 7}
          fill="none"
          stroke={contour}
          strokeWidth="0.35"
          transform={`rotate(${pick(20, -18, 18)} ${mx} ${my})`}
        />
      ))}
      <path
        d={`M${ax} ${ay} C ${ax + 22} ${ay - 6}, ${mx - 18} ${my - 14}, ${mx} ${my}`}
        fill="none"
        stroke={route}
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeDasharray="1.6 1.4"
      />
      <path
        d={`M${bx} ${by} C ${bx - 6} ${by - 22}, ${mx + 16} ${my + 18}, ${mx} ${my}`}
        fill="none"
        stroke={route}
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeDasharray="1.6 1.4"
      />
      <circle cx={mx} cy={my} r="4.5" fill="rgb(176 138 85 / 0.18)" />
      <circle cx={mx} cy={my} r="1.7" fill="#b08a55" />
    </svg>
  );
}

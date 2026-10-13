import "server-only";

export interface ExchangeRates {
  /** ILS per 1 EUR */
  ilsPerEur: number;
  /** ILS per 1 USD */
  ilsPerUsd: number;
  /** ILS per 1 unit of every currency upstream knows (ILS: 1) */
  ilsPer: Record<string, number>;
  /** Upstream's last-update time, epoch ms */
  updatedAt: number;
}

// Warm-lambda cache on top of the Next data cache
let cached: { data: ExchangeRates; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Daily market rates from the keyless open.er-api.com endpoint. */
export async function fetchExchangeRates(): Promise<ExchangeRates | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
      signal: controller.signal,
      next: { revalidate: 21_600 },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_unix?: number;
    };
    const ils = payload.rates?.ILS;
    const usd = payload.rates?.USD;
    if (payload.result !== "success" || !ils || !usd || ils <= 0 || usd <= 0) {
      return null;
    }
    // rates are "units per 1 EUR" → ILS per unit = ils / rate
    const ilsPer: Record<string, number> = { ILS: 1 };
    for (const [code, rate] of Object.entries(payload.rates ?? {})) {
      if (typeof rate === "number" && rate > 0) ilsPer[code] = ils / rate;
    }
    const data: ExchangeRates = {
      ilsPerEur: ils,
      ilsPerUsd: ils / usd,
      ilsPer,
      updatedAt: (payload.time_last_update_unix ?? 0) * 1000 || Date.now(),
    };
    cached = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

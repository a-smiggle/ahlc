import type { BankProfile } from "@/config/assumptions";

const LIVE_RATES_CACHE_KEY = "ahlc-live-rates-cache-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
const FETCH_TIMEOUT_MS = 10_000;
const MAX_DETAIL_FETCHES = 10;

// CDR-compliant public product endpoints confirmed to support CORS and public access.
// All Australian CDR Data Holders are required by the CDR Standards to support CORS
// on unauthenticated public product APIs (CDS section 4.1).
const CDR_SOURCES = [
  {
    id: "bank-australia",
    label: "Bank Australia",
    productsUrl: "https://public.cdr.bankaust.com.au/cds-au/v1/banking/products",
    productDetailsUrlTemplate: "https://public.cdr.bankaust.com.au/cds-au/v1/banking/products/{productId}"
  },
  {
    id: "macquarie-bank-limited",
    label: "Macquarie Bank",
    productsUrl: "https://api.macquariebank.io/cds-au/v1/banking/products",
    productDetailsUrlTemplate: "https://api.macquariebank.io/cds-au/v1/banking/products/{productId}"
  },
  {
    id: "qudos-bank",
    label: "Qudos Bank",
    productsUrl: "https://public.cdr.qudosbank.com.au/cds-au/v1/banking/products",
    productDetailsUrlTemplate: "https://public.cdr.qudosbank.com.au/cds-au/v1/banking/products/{productId}"
  }
] as const;

interface CdrLendingRate {
  lendingRateType?: string;
  lendingRateName?: string;
  applicationFrequency?: string;
  rate?: string | number;
}

interface CdrProduct {
  productId?: string;
  productCategory?: string;
  lendingRates?: CdrLendingRate[];
}

interface CdrProductsPayload {
  data?: { products?: CdrProduct[] };
}

export interface LiveRatesCache {
  fetchedAtIso: string;
  profiles: BankProfile[];
}

const canUseStorage = (): boolean => typeof window !== "undefined";

const asNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const looksLikeVariableRate = (rate: CdrLendingRate): boolean => {
  const d = `${rate.lendingRateType ?? ""} ${rate.lendingRateName ?? ""} ${rate.applicationFrequency ?? ""}`.toLowerCase();
  if (d.includes("fixed")) return false;
  return d.includes("variable") || d.includes("standard") || d.includes("interest") || d.trim() === "";
};

const extractRatesFromList = (payload: CdrProductsPayload): number[] => {
  const rates: number[] = [];
  for (const product of payload?.data?.products ?? []) {
    if (product.productCategory !== "RESIDENTIAL_MORTGAGES") continue;
    for (const rate of product.lendingRates ?? []) {
      const v = asNumber(rate.rate);
      if (v !== undefined && looksLikeVariableRate(rate)) rates.push(v);
    }
  }
  return rates;
};

const extractRatesFromDetail = (payload: unknown): number[] => {
  const p = payload as { data?: { lendingRates?: CdrLendingRate[] }; lendingRates?: CdrLendingRate[] };
  const rates: number[] = [];
  for (const rate of p?.data?.lendingRates ?? p?.lendingRates ?? []) {
    const v = asNumber(rate.rate);
    if (v !== undefined && looksLikeVariableRate(rate)) rates.push(v);
  }
  return rates;
};

const getMortgageProductIds = (payload: CdrProductsPayload): string[] =>
  [
    ...new Set(
      (payload?.data?.products ?? [])
        .filter((p) => p.productCategory === "RESIDENTIAL_MORTGAGES" && typeof p.productId === "string")
        .map((p) => p.productId as string)
    )
  ];

const fetchCdr = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "x-v": "1", "x-min-v": "1" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const fetchProfileFromSource = async (source: (typeof CDR_SOURCES)[number]): Promise<BankProfile | null> => {
  try {
    const payload = (await fetchCdr(source.productsUrl)) as CdrProductsPayload;
    let rates = extractRatesFromList(payload);

    if (rates.length === 0) {
      const ids = getMortgageProductIds(payload).slice(0, MAX_DETAIL_FETCHES);
      await Promise.allSettled(
        ids.map(async (productId) => {
          try {
            const detail = await fetchCdr(
              source.productDetailsUrlTemplate.replace("{productId}", encodeURIComponent(productId))
            );
            rates = rates.concat(extractRatesFromDetail(detail));
          } catch {
            // individual detail failures are expected and ignored
          }
        })
      );
    }

    if (rates.length === 0) return null;

    const minRate = Math.min(...rates);
    const spread = Math.max(...rates) - minRate;

    return {
      id: source.id,
      label: source.label,
      assessmentBuffer: 0.03,
      rentalShading: spread > 0.015 ? 0.75 : 0.8,
      variableIncomeShading: 0.8,
      expenseLoading: spread > 0.02 ? 1.12 : 1.1,
      indicativeVariableRate: Number(minRate.toFixed(4))
    };
  } catch {
    // Network/CORS failures are expected for some sources and silently ignored
    return null;
  }
};

export const readLiveRatesCache = (): LiveRatesCache | null => {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(LIVE_RATES_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LiveRatesCache;
  } catch {
    return null;
  }
};

export const isLiveRatesCacheStale = (cache: LiveRatesCache | null): boolean => {
  if (!cache) return true;
  return Date.now() - new Date(cache.fetchedAtIso).getTime() > MAX_AGE_MS;
};

export const refreshLiveRates = async (): Promise<LiveRatesCache> => {
  const results = await Promise.allSettled(CDR_SOURCES.map((source) => fetchProfileFromSource(source)));
  const profiles = results
    .filter((r): r is PromiseFulfilledResult<BankProfile> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);

  const cache: LiveRatesCache = { fetchedAtIso: new Date().toISOString(), profiles };

  if (canUseStorage()) {
    window.localStorage.setItem(LIVE_RATES_CACHE_KEY, JSON.stringify(cache));
  }

  return cache;
};

export const clearLiveRatesCache = (): void => {
  if (canUseStorage()) {
    window.localStorage.removeItem(LIVE_RATES_CACHE_KEY);
  }
};

/** Merges any cached live CDR rates into the baseline profile list.
 *  Existing profiles are updated in place; newly discovered profiles are appended.
 *  Call this BEFORE applying user overrides. */
export const applyLiveRatesToProfiles = (baseProfiles: BankProfile[]): BankProfile[] => {
  const cache = readLiveRatesCache();
  if (!cache || cache.profiles.length === 0) return baseProfiles;

  const merged = [...baseProfiles];
  for (const live of cache.profiles) {
    const idx = merged.findIndex((p) => p.id === live.id);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...live };
    } else {
      merged.push(live as BankProfile);
    }
  }
  return merged;
};

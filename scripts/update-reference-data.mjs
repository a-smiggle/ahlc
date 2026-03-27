#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const targetPath = path.join(projectRoot, "src", "data", "reference-data.latest.json");
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const noBankFetch = process.argv.includes("--no-bank-fetch");
const timeoutArg = process.argv.find((arg) => arg.startsWith("--timeout-ms="));
const timeoutMs = Number(timeoutArg?.replace("--timeout-ms=", "") ?? "8000");
const sourcesFileArg = process.argv.find((arg) => arg.startsWith("--sources-file="));

const defaultSourcesPath = path.join(projectRoot, "scripts", "bank-data-sources.json");
const sourcesPath = sourcesFileArg
  ? path.isAbsolute(sourcesFileArg.replace("--sources-file=", ""))
    ? sourcesFileArg.replace("--sources-file=", "")
    : path.join(projectRoot, sourcesFileArg.replace("--sources-file=", ""))
  : defaultSourcesPath;

const bumpVersion = (previousVersion) => {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${String(now.getUTCDate()).padStart(2, "0")}`;

  if (!previousVersion || !previousVersion.startsWith(datePart)) {
    return `${datePart}.1`;
  }

  const parts = previousVersion.split(".");
  const revision = Number(parts[3] ?? "1");
  return `${datePart}.${Number.isFinite(revision) ? revision + 1 : 2}`;
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const getSourceUrls = (source) => {
  const urls = [];

  if (typeof source?.productsUrl === "string" && source.productsUrl.trim()) {
    urls.push(source.productsUrl.trim());
  }

  if (Array.isArray(source?.productsUrls)) {
    for (const candidate of source.productsUrls) {
      if (typeof candidate === "string" && candidate.trim()) {
        urls.push(candidate.trim());
      }
    }
  }

  return [...new Set(urls)];
};

const asNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const looksLikeVariableRate = (rateRecord) => {
  const descriptor = `${rateRecord?.lendingRateType ?? ""} ${rateRecord?.lendingRateName ?? ""} ${rateRecord?.applicationFrequency ?? ""}`
    .toLowerCase()
    .trim();

  if (!descriptor) {
    return true;
  }

  if (descriptor.includes("fixed")) {
    return false;
  }

  return descriptor.includes("variable") || descriptor.includes("standard") || descriptor.includes("interest");
};

const collectCandidateRates = (productsPayload) => {
  const products = productsPayload?.data?.products;

  if (!Array.isArray(products)) {
    return [];
  }

  const rates = [];

  for (const product of products) {
    if (product?.productCategory !== "RESIDENTIAL_MORTGAGES") {
      continue;
    }

    const lendingRates = Array.isArray(product?.lendingRates) ? product.lendingRates : [];

    for (const lendingRate of lendingRates) {
      const value = asNumber(lendingRate?.rate);

      if (value === undefined) {
        continue;
      }

      if (!looksLikeVariableRate(lendingRate)) {
        continue;
      }

      rates.push(value);
    }
  }

  return rates;
};

const getResidentialMortgageProductIds = (productsPayload) => {
  const products = productsPayload?.data?.products;

  if (!Array.isArray(products)) {
    return [];
  }

  const ids = [];

  for (const product of products) {
    if (product?.productCategory !== "RESIDENTIAL_MORTGAGES") {
      continue;
    }

    const productId = typeof product?.productId === "string" ? product.productId.trim() : "";

    if (productId) {
      ids.push(productId);
    }
  }

  return [...new Set(ids)];
};

const collectCandidateRatesFromProductDetail = (productDetailPayload) => {
  const lendingRates = Array.isArray(productDetailPayload?.data?.lendingRates)
    ? productDetailPayload.data.lendingRates
    : Array.isArray(productDetailPayload?.lendingRates)
      ? productDetailPayload.lendingRates
      : [];

  const rates = [];

  for (const lendingRate of lendingRates) {
    const value = asNumber(lendingRate?.rate);

    if (value === undefined) {
      continue;
    }

    if (!looksLikeVariableRate(lendingRate)) {
      continue;
    }

    rates.push(value);
  }

  return rates;
};

const getProductDetailsTemplate = (source, successfulUrl) => {
  if (typeof source?.productDetailsUrlTemplate === "string" && source.productDetailsUrlTemplate.trim()) {
    return source.productDetailsUrlTemplate.trim();
  }

  if (!successfulUrl) {
    return "";
  }

  return `${successfulUrl.replace(/\/$/, "")}/{productId}`;
};

const collectRatesFromProductDetails = async (productsPayload, source, successfulUrl) => {
  const productIds = getResidentialMortgageProductIds(productsPayload);

  if (productIds.length === 0) {
    return { rates: [], attempted: 0, failed: 0 };
  }

  const template = getProductDetailsTemplate(source, successfulUrl);

  if (!template.includes("{productId}")) {
    return { rates: [], attempted: 0, failed: productIds.length };
  }

  const maxDetailsToFetch = 20;
  const selectedIds = productIds.slice(0, maxDetailsToFetch);
  const rates = [];
  let failed = 0;

  for (const productId of selectedIds) {
    const url = template.replace("{productId}", encodeURIComponent(productId));

    try {
      const detailPayload = await fetchJsonWithFallbackHeaders(url, timeoutMs, source?.headers ?? {});
      rates.push(...collectCandidateRatesFromProductDetail(detailPayload));
    } catch {
      failed += 1;
    }
  }

  return { rates, attempted: selectedIds.length, failed };
};

const normaliseBankLabel = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const fetchJson = async (url, timeout, extraHeaders = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-v": "1",
        "x-min-v": "1",
        "User-Agent": "ahlc-reference-data-updater/1.0",
        ...extraHeaders
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const fetchJsonWithFallbackHeaders = async (url, timeout, extraHeaders = {}) => {
  const headerVariants = [
    {
      Accept: "application/json",
      "x-v": "1",
      "x-min-v": "1",
      "User-Agent": "ahlc-reference-data-updater/1.0",
      ...extraHeaders
    },
    {
      Accept: "application/json",
      "User-Agent": "ahlc-reference-data-updater/1.0",
      ...extraHeaders
    },
    {
      Accept: "*/*",
      "User-Agent": "ahlc-reference-data-updater/1.0",
      ...extraHeaders
    },
    {
      Accept: "application/json",
      "x-v": "3",
      "x-min-v": "1",
      "User-Agent": "ahlc-reference-data-updater/1.0",
      ...extraHeaders
    }
  ];

  const errors = [];

  for (const headers of headerVariants) {
    try {
      return await fetchJson(url, timeout, headers);
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }

  throw new Error(`header-variants-failed: ${errors.join(" | ")}`);
};

const fetchRealWorldBankProfiles = async (sources) => {
  const successful = [];
  const failed = [];

  for (const source of sources) {
    if (source?.enabled === false) {
      continue;
    }

    const id = source?.id || normaliseBankLabel(source?.label || "bank");
    const label = source?.label || id;
    const urls = getSourceUrls(source);

    if (urls.length === 0) {
      failed.push({ id, label, reason: "missing-productsUrl" });
      continue;
    }

    let fetchedPayload;
    let successfulUrl = "";
    const urlErrors = [];

    for (const url of urls) {
      try {
        fetchedPayload = await fetchJsonWithFallbackHeaders(url, timeoutMs, source?.headers ?? {});
        successfulUrl = url;
        break;
      } catch (error) {
        urlErrors.push({ url, reason: String(error?.message ?? error) });
      }
    }

    try {
      if (!fetchedPayload) {
        throw new Error(`all-endpoints-failed: ${urlErrors.map((entry) => `${entry.url} => ${entry.reason}`).join(" | ")}`);
      }

      const candidateRates = collectCandidateRates(fetchedPayload);

      let resolvedRates = candidateRates;
      let detailsAttempted = 0;
      let detailsFailed = 0;

      if (resolvedRates.length === 0) {
        const detailsResult = await collectRatesFromProductDetails(fetchedPayload, source, successfulUrl);
        resolvedRates = detailsResult.rates;
        detailsAttempted = detailsResult.attempted;
        detailsFailed = detailsResult.failed;
      }

      if (resolvedRates.length === 0) {
        failed.push({
          id,
          label,
          reason: "no-mortgage-rates",
          url: successfulUrl,
          productDetailsAttempted: detailsAttempted,
          productDetailsFailed: detailsFailed
        });
        continue;
      }

      const minRate = Math.min(...resolvedRates);
      const rateSpread = Math.max(...resolvedRates) - minRate;

      successful.push({
        id,
        label,
        url: successfulUrl,
        observedVariableRate: Number(minRate.toFixed(4)),
        productDetailsAttempted: detailsAttempted,
        productDetailsFailed: detailsFailed,
        profile: {
          id,
          label,
          assessmentBuffer: 0.03,
          rentalShading: rateSpread > 0.015 ? 0.75 : 0.8,
          variableIncomeShading: 0.8,
          expenseLoading: rateSpread > 0.02 ? 1.12 : 1.1
        }
      });
    } catch (error) {
      failed.push({ id, label, reason: String(error?.message ?? error) });
    }
  }

  return { successful, failed };
};

const main = async () => {
  const existing = await readJson(targetPath);

  let next = { ...existing };

  if (inputArg) {
    const inputPath = inputArg.replace("--input=", "");
    const resolved = path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
    const incoming = await readJson(resolved);

    next = {
      ...next,
      ...incoming,
      metadata: {
        ...next.metadata,
        ...incoming.metadata
      }
    };
  }

  let bankDataResult = {
    successful: [],
    failed: []
  };

  if (!noBankFetch) {
    try {
      const sources = await readJson(sourcesPath);

      if (Array.isArray(sources) && sources.length > 0) {
        bankDataResult = await fetchRealWorldBankProfiles(sources);

        if (bankDataResult.successful.length > 0) {
          // Merge live CDR results into existing curated baseline:
          // - update any profile that already exists in the baseline (by id)
          // - append any newly discovered profile that is not in the baseline
          const baseline = Array.isArray(next.bankProfiles) ? next.bankProfiles : [];
          const liveProfiles = bankDataResult.successful.map((entry) => entry.profile);

          const merged = [...baseline];
          for (const live of liveProfiles) {
            const existingIndex = merged.findIndex((p) => p.id === live.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...live };
            } else {
              merged.push(live);
            }
          }
          next.bankProfiles = merged;
        }
      }
    } catch (error) {
      bankDataResult.failed.push({
        id: "sources-file",
        label: "sources-file",
        reason: String(error?.message ?? error)
      });
    }
  }

  next.metadata = {
    ...next.metadata,
    datasetVersion: bumpVersion(next.metadata?.datasetVersion),
    updatedAtIso: new Date().toISOString(),
    source: inputArg ? "merged-from-input" : "scheduled-refresh",
    realWorldBankData: {
      attempted: !noBankFetch,
      successfulSources: bankDataResult.successful.length,
      failedSources: bankDataResult.failed.length,
      successful: bankDataResult.successful.map((entry) => ({
        id: entry.id,
        label: entry.label,
        url: entry.url,
        observedVariableRate: entry.observedVariableRate,
        productDetailsAttempted: entry.productDetailsAttempted,
        productDetailsFailed: entry.productDetailsFailed
      })),
      failed: bankDataResult.failed
    }
  };

  await fs.writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`Updated reference data: ${targetPath}`);
  console.log(`Version: ${next.metadata.datasetVersion}`);
  console.log(
    `Real-world bank data: ${next.metadata.realWorldBankData.successfulSources} success, ${next.metadata.realWorldBankData.failedSources} failed`
  );
};

main().catch((error) => {
  console.error("Failed to update reference data:", error);
  process.exitCode = 1;
});

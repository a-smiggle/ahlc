import type { BankProfile } from "@/config/assumptions";

const CUSTOM_PROFILE_OVERRIDES_KEY = "ahlc-custom-bank-profile-overrides-v1";

type BankProfileEditableFields = Pick<
  BankProfile,
  "assessmentBuffer" | "rentalShading" | "variableIncomeShading" | "expenseLoading"
>;

export type BankProfileOverride = Partial<BankProfileEditableFields>;

const canUseStorage = () => typeof window !== "undefined";

const readOverrides = (): Record<string, BankProfileOverride> => {
  if (!canUseStorage()) {
    return {};
  }

  const raw = window.localStorage.getItem(CUSTOM_PROFILE_OVERRIDES_KEY);

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, BankProfileOverride>;
  } catch {
    return {};
  }
};

const writeOverrides = (overrides: Record<string, BankProfileOverride>) => {
  if (!canUseStorage()) {
    return;
  }

  if (Object.keys(overrides).length === 0) {
    window.localStorage.removeItem(CUSTOM_PROFILE_OVERRIDES_KEY);
    return;
  }

  window.localStorage.setItem(CUSTOM_PROFILE_OVERRIDES_KEY, JSON.stringify(overrides));
};

const pickChangedFields = (base: BankProfile, candidate: BankProfileEditableFields): BankProfileOverride => {
  const changed: BankProfileOverride = {};

  if (candidate.assessmentBuffer !== base.assessmentBuffer) {
    changed.assessmentBuffer = candidate.assessmentBuffer;
  }
  if (candidate.rentalShading !== base.rentalShading) {
    changed.rentalShading = candidate.rentalShading;
  }
  if (candidate.variableIncomeShading !== base.variableIncomeShading) {
    changed.variableIncomeShading = candidate.variableIncomeShading;
  }
  if (candidate.expenseLoading !== base.expenseLoading) {
    changed.expenseLoading = candidate.expenseLoading;
  }

  return changed;
};

export const mergeBankProfilesWithOverrides = (baseProfiles: BankProfile[]): BankProfile[] => {
  const overrides = readOverrides();

  return baseProfiles.map((base) => {
    const override = overrides[base.id];

    if (!override) {
      return base;
    }

    return {
      ...base,
      ...override,
      label: base.label
    };
  });
};

export const saveBankProfileOverride = (
  baseProfiles: BankProfile[],
  profileId: string,
  patch: Partial<BankProfileEditableFields>
) => {
  const baseProfile = baseProfiles.find((profile) => profile.id === profileId);

  if (!baseProfile) {
    return;
  }

  const overrides = readOverrides();
  const existing = overrides[profileId] ?? {};
  const candidate: BankProfileEditableFields = {
    assessmentBuffer: patch.assessmentBuffer ?? existing.assessmentBuffer ?? baseProfile.assessmentBuffer,
    rentalShading: patch.rentalShading ?? existing.rentalShading ?? baseProfile.rentalShading,
    variableIncomeShading:
      patch.variableIncomeShading ?? existing.variableIncomeShading ?? baseProfile.variableIncomeShading,
    expenseLoading: patch.expenseLoading ?? existing.expenseLoading ?? baseProfile.expenseLoading
  };

  const changed = pickChangedFields(baseProfile, candidate);

  if (Object.keys(changed).length === 0) {
    delete overrides[profileId];
  } else {
    overrides[profileId] = changed;
  }

  writeOverrides(overrides);
};

export const clearBankProfileOverride = (profileId: string) => {
  const overrides = readOverrides();
  delete overrides[profileId];
  writeOverrides(overrides);
};

export const clearAllBankProfileOverrides = () => {
  writeOverrides({});
};

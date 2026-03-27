import type { AppState } from "@/types/models";

const STORAGE_KEY = "ahlc-state-v1";

export const saveState = (state: AppState): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadState = (): AppState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
};

export const clearState = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
};

export const exportStateJson = (state: AppState): string => JSON.stringify(state, null, 2);

export const importStateJson = (json: string): AppState => {
  return JSON.parse(json) as AppState;
};

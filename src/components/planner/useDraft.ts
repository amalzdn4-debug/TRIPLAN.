"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Form state persisted in sessionStorage so that switching language, signing in,
 * or an accidental reload never loses what the traveller typed. Non-sensitive data only.
 */
export function useDraft<T extends object>(key: string, initial: T, overrides: Partial<T> = {}) {
  const storageKey = `triplan:draft:${key}`;
  const [value, setValue] = useState<T>(() => ({ ...initial, ...overrides }));
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<T>;
        // URL-provided values (e.g. ?destination=) win over an older draft.
        setValue((v) => ({ ...v, ...saved, ...overrides }));
      } else if (Object.keys(overrides).length) {
        setValue((v) => ({ ...v, ...overrides }));
      }
    } catch {
      /* ignore corrupt drafts */
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* storage full or disabled */
    }
  }, [storageKey, value]);

  const update = useCallback(<K extends keyof T>(k: K, v: T[K]) => setValue((s) => ({ ...s, [k]: v })), []);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
  }, [storageKey]);
  return { value, setValue, update, clear };
}

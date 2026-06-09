/**
 * Command Center layout preferences — widget order + visibility.
 *
 * Persists per-user to localStorage (the migration plan's "localStorage
 * first" step; graduates to a user_preferences table when multi-device
 * sync is needed). Unknown/removed widget ids are dropped on load and
 * newly-added widgets are appended, so the registry can evolve without
 * stranding a saved layout.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

export type WidgetId = "kpis" | "operations" | "analytics" | "recent";

export const DEFAULT_ORDER: WidgetId[] = ["kpis", "operations", "analytics", "recent"];

type Stored = { order: WidgetId[]; hidden: WidgetId[] };

const KEY = (userId?: string) => `autocurb:v2-dashboard-layout:${userId || "anon"}`;

const isWidgetId = (v: unknown): v is WidgetId =>
  typeof v === "string" && (DEFAULT_ORDER as string[]).includes(v);

/** Keep only known ids, then append any defaults the saved list lacks. */
const reconcile = (saved: WidgetId[]): WidgetId[] => {
  const known = saved.filter(isWidgetId);
  const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
  return [...known, ...missing];
};

export function useDashboardLayout(userId?: string) {
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<WidgetId[]>([]);

  // Load when the user identity resolves.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(userId));
      if (!raw) {
        setOrder(DEFAULT_ORDER);
        setHidden([]);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<Stored>;
      setOrder(reconcile(Array.isArray(parsed.order) ? parsed.order : DEFAULT_ORDER));
      setHidden((Array.isArray(parsed.hidden) ? parsed.hidden : []).filter(isWidgetId));
    } catch {
      setOrder(DEFAULT_ORDER);
      setHidden([]);
    }
  }, [userId]);

  const persist = useCallback(
    (next: Stored) => {
      try {
        localStorage.setItem(KEY(userId), JSON.stringify(next));
      } catch {
        /* storage full / unavailable — non-fatal */
      }
    },
    [userId],
  );

  const reorder = useCallback(
    (next: WidgetId[]) => {
      const clean = reconcile(next);
      setOrder(clean);
      persist({ order: clean, hidden });
    },
    [hidden, persist],
  );

  const toggle = useCallback(
    (id: WidgetId) => {
      setHidden((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        persist({ order, hidden: next });
        return next;
      });
    },
    [order, persist],
  );

  const reset = useCallback(() => {
    setOrder(DEFAULT_ORDER);
    setHidden([]);
    try {
      localStorage.removeItem(KEY(userId));
    } catch {
      /* non-fatal */
    }
  }, [userId]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const isHidden = useCallback((id: WidgetId) => hiddenSet.has(id), [hiddenSet]);

  return { order, isHidden, reorder, toggle, reset };
}

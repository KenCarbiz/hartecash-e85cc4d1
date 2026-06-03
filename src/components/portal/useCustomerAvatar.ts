// Customer-portal avatar resolver.
//
// Resolution order:
//   1. A customer-chosen avatar (uploaded image or preset key) saved in
//      localStorage, keyed by the portal token. This is per-device but
//      requires no backend migration to ship.
//   2. If a Supabase auth session exists and that user has a
//      profile.profile_image_url (i.e. an employee is previewing the
//      portal), surface that as the default.
//   3. null → caller renders the initials fallback.
//
// Components that mutate the avatar should call `setCustomerAvatar()`
// — it writes to localStorage and dispatches a window event so every
// hook instance re-reads in the same tick (avatar shows up in the
// drawer header, account menu, and any future surface simultaneously).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const EVENT = "customer-avatar-changed";

const storageKey = (token: string | null) =>
  `portal-customer-avatar:${token ?? "demo"}`;

export const setCustomerAvatar = (token: string | null, value: string | null) => {
  const key = storageKey(token);
  if (value) {
    try { localStorage.setItem(key, value); } catch { /* quota */ }
  } else {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { token, value } }));
};

const readCustomer = (token: string | null): string | null => {
  try { return localStorage.getItem(storageKey(token)); } catch { return null; }
};

export interface CustomerAvatarState {
  /** Resolved URL or data-URL to render, or null for initials fallback. */
  url: string | null;
  /** Where the URL came from — useful for "Reset to employee photo" UX. */
  source: "customer" | "employee" | "none";
  /** True until the auth check resolves; render initials in the meantime. */
  loading: boolean;
}

export const useCustomerAvatar = (token: string | null): CustomerAvatarState => {
  const [customer, setCustomer] = useState<string | null>(() => readCustomer(token));
  const [employee, setEmployee] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-read localStorage when the token changes or another component
  // updates the avatar (cross-component sync within the same tab).
  useEffect(() => {
    setCustomer(readCustomer(token));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { token: string | null };
      if (detail?.token === token) setCustomer(readCustomer(token));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(token)) setCustomer(readCustomer(token));
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [token]);

  // One-shot auth check: if an employee is logged in, pull their photo.
  // Portal visitors via magic link won't have a session — this just
  // returns null in that case, and we fall back to the customer choice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { setLoading(false); return; }
        const { data } = await supabase
          .from("profiles")
          .select("profile_image_url")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setEmployee(data?.profile_image_url ?? null);
      } catch {
        // Anonymous portal session — expected, ignore.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (customer) return { url: customer, source: "customer", loading };
  if (employee) return { url: employee, source: "employee", loading };
  return { url: null, source: "none", loading };
};

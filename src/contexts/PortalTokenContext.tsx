// PortalTokenContext — provides the customer's submission token (or
// null in demo mode) to every page below the portal shell.
//
// Mounted once by `PortalPreview` in `src/pages/PortalPreview.tsx`.
//
// Why a context instead of useParams in every page:
//   * The same component tree serves two routes — /portal-preview
//     (no token) and /my-submission/:token (real customer). Centralizing
//     the demo-vs-live decision here means every page is unaware of
//     route shape.
//   * Hooks below the shell need the token at query-key construction
//     time. A single `usePortalToken()` call is cleaner than passing
//     the token through three layers of children.
//   * If we ever need to swap submissions inside the same shell (e.g.,
//     a vehicle-picker for customers with multiple open submissions),
//     this is the natural seam.
//
// IMPORTANT — null token contract:
//   * `token = null` means "demo / preview route" and is the cue for
//     every data hook to resolve to mock data instead of hitting
//     Supabase.
//   * `token = ""` should never happen. Hooks must treat empty string
//     as null (defensive — useParams can occasionally return "" for
//     a missing param depending on route definition).
//   * `isDemo` is the canonical predicate; don't check `!token` in
//     pages, check `isDemo`. The two are equivalent today but the
//     name carries intent.
import { createContext, useContext, useMemo, type ReactNode } from "react";

interface PortalTokenValue {
  token: string | null;
  isDemo: boolean;
}

const PortalTokenContext = createContext<PortalTokenValue | null>(null);

interface ProviderProps {
  // The raw token from useParams. Pass undefined for the demo route.
  token: string | undefined;
  children: ReactNode;
}

export const PortalTokenProvider = ({ token, children }: ProviderProps) => {
  const value = useMemo<PortalTokenValue>(() => {
    const cleaned = token && token.trim().length > 0 ? token.trim() : null;
    return { token: cleaned, isDemo: cleaned === null };
  }, [token]);
  return (
    <PortalTokenContext.Provider value={value}>
      {children}
    </PortalTokenContext.Provider>
  );
};

export const usePortalToken = (): PortalTokenValue => {
  const ctx = useContext(PortalTokenContext);
  if (!ctx) {
    // Failing loudly is correct — any page that calls usePortalToken
    // outside the shell is a programming error, not a runtime
    // condition the user can recover from.
    throw new Error(
      "usePortalToken must be used inside <PortalTokenProvider>. " +
      "This is mounted once by PortalPreview at the top of /portal-preview " +
      "and /my-submission/:token.",
    );
  }
  return ctx;
};

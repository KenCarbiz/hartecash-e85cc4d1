import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ALL_SECTIONS,
  defaultAllowedForRole,
} from "@/lib/rolePermissionDefaults";

/**
 * Resolves the full permission cascade for the current user:
 *   per-user grant > store override > tenant override > platform default
 *   > built-in default (rolePermissionDefaults.ts)
 * Plus an additive appraiser layer when user_roles.is_appraiser is true.
 *
 * Returns null for admin (unrestricted), a string[] of allowed section
 * keys otherwise. Loading is true until the first response.
 */
export function useEffectivePermissions(
  userId: string | null,
  isAdmin: boolean,
  userRole: string,
  isAppraiser: boolean,
) {
  const [allowedSections, setAllowedSections] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (isAdmin) {
      setAllowedSections(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      // Build the section→fallback list FE-side using the canonical
      // default map. Appraisers get the union of their primary role's
      // defaults and the appraiser defaults (matches how the SQL
      // function ORs the override layers).
      const sections = ALL_SECTIONS.map((s) => {
        const primaryDefault = defaultAllowedForRole(userRole, s.key);
        const appraiserDefault = isAppraiser
          ? defaultAllowedForRole("appraiser", s.key)
          : false;
        return { key: s.key, fallback: primaryDefault || appraiserDefault };
      });

      const { data, error } = await supabase.rpc(
        "effective_user_sections" as any,
        { _user_id: userId, _sections: sections } as any,
      );

      if (cancelled) return;
      if (error || !Array.isArray(data)) {
        // Fail closed to FE defaults so the user is never locked out
        // entirely if the RPC isn't deployed yet on this environment.
        const fallback = sections.filter((s) => s.fallback).map((s) => s.key);
        setAllowedSections(fallback);
      } else {
        setAllowedSections(data as string[]);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, isAdmin, userRole, isAppraiser]);

  const hasAccess = (section: string) => {
    if (allowedSections === null) return true;
    return allowedSections.includes(section);
  };

  return { allowedSections, loading, hasAccess };
}

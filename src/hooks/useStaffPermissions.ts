import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  allowed_sections: string[];
  is_default: boolean;
}

/**
 * Loads the current user's allowed admin sections based on their permission group assignments.
 * Admins always get full access.
 */
export function useStaffPermissions(userId: string | null, isAdmin: boolean) {
  const [allowedSections, setAllowedSections] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Admins get everything
    if (isAdmin) {
      setAllowedSections(null); // null = unrestricted
      setLoading(false);
      return;
    }

    const fetch = async () => {
      // Get user's assigned permission groups
      const { data: assignments } = await supabase
        .from("staff_permission_assignments" as any)
        .select("permission_group_id")
        .eq("user_id", userId);

      if (!assignments || assignments.length === 0) {
        // Check if there's a default group
        const { data: defaults } = await supabase
          .from("permission_groups" as any)
          .select("allowed_sections")
          .eq("is_default", true);

        if (defaults && defaults.length > 0) {
          const sections = new Set<string>();
          (defaults as any[]).forEach((g: any) => {
            (g.allowed_sections || []).forEach((s: string) => sections.add(s));
          });
          setAllowedSections(Array.from(sections));
        } else {
          setAllowedSections([]); // no access
        }
        setLoading(false);
        return;
      }

      const groupIds = (assignments as any[]).map((a: any) => a.permission_group_id);
      const { data: groups } = await supabase
        .from("permission_groups" as any)
        .select("allowed_sections")
        .in("id", groupIds);

      const sections = new Set<string>();
      (groups as any[] || []).forEach((g: any) => {
        (g.allowed_sections || []).forEach((s: string) => sections.add(s));
      });
      setAllowedSections(Array.from(sections));
      setLoading(false);
    };

    fetch();
  }, [userId, isAdmin]);

  const hasAccess = (section: string) => {
    if (allowedSections === null) return true; // admin = unrestricted
    return allowedSections.includes(section);
  };

  return { allowedSections, loading, hasAccess };
}

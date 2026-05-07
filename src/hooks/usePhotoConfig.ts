import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PreAppointmentRole = "off" | "optional" | "required";
export type BoostRole = "off" | "bonus" | "required";

export interface PhotoShot {
  id: string;
  shot_id: string;
  label: string;
  description: string;
  orientation: string;
  /**
   * Legacy flag — kept so older readers compile, but the source of
   * truth for visibility is now pre_appointment_role + boost_role.
   * A row is "enabled" anywhere whenever either role is non-"off".
   */
  is_enabled: boolean;
  is_required: boolean;
  pre_appointment_role: PreAppointmentRole;
  boost_role: BoostRole;
  sort_order: number;
}

/**
 * Fetches photo configuration for a dealership.
 * Falls back to 'default' dealership config if none found for the given ID.
 *
 * Two role axes per shot drive both customer-facing flows:
 *   - pre_appointment_role: how the shot behaves in /upload/:token
 *       (off | optional | required)
 *   - boost_role:           how the shot behaves in /boost-offer/:token
 *       (off | bonus | required)
 *
 * The selectors below give each call site a focused view of the
 * catalog without re-implementing the filter logic.
 */
export const usePhotoConfig = (dealershipId: string = "default") => {
  const [shots, setShots] = useState<PhotoShot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Try tenant-specific first
      let { data } = await supabase
        .from("photo_config")
        .select("*")
        .eq("dealership_id", dealershipId)
        .order("sort_order");

      // Fallback to default
      if (!data || data.length === 0) {
        const res = await supabase
          .from("photo_config")
          .select("*")
          .eq("dealership_id", "default")
          .order("sort_order");
        data = res.data;
      }

      if (data) {
        setShots(data.map((d) => {
          // pre_appointment_role / boost_role are NOT NULL with a
          // default of 'off' in the DB, but we soft-fall-back here
          // so the hook keeps working against an instance that
          // hasn't applied 20260507010000_unified_photo_roles.sql
          // yet (per CLAUDE.md, migrations are not auto-applied).
          const preRole = (d.pre_appointment_role as PreAppointmentRole | null)
            ?? (d.is_enabled === false
              ? "off"
              : d.is_required
                ? "required"
                : "optional");
          const boostRole = (d.boost_role as BoostRole | null) ?? "off";
          return {
            id: d.id,
            shot_id: d.shot_id,
            label: d.label,
            description: d.description,
            orientation: d.orientation,
            is_enabled: d.is_enabled,
            is_required: d.is_required,
            pre_appointment_role: preRole,
            boost_role: boostRole,
            sort_order: d.sort_order,
          };
        }));
      }
      setLoading(false);
    };
    fetch();
  }, [dealershipId]);

  // ── Pre-appointment (standard upload flow) ──────────────────────────────
  // Legacy callers still read enabledShots / requiredShots / optionalShots
  // and expect them keyed against the standard upload flow, so keep those
  // names mapped to pre_appointment_role.
  const enabledShots  = shots.filter((s) => s.pre_appointment_role !== "off");
  const requiredShots = shots.filter((s) => s.pre_appointment_role === "required");
  const optionalShots = shots.filter((s) => s.pre_appointment_role === "optional");

  // ── Boost flow ──────────────────────────────────────────────────────────
  const boostRequiredShots = shots.filter((s) => s.boost_role === "required");
  const boostBonusShots    = shots.filter((s) => s.boost_role === "bonus");
  const boostShots         = shots.filter((s) => s.boost_role !== "off");

  return {
    shots,
    enabledShots,
    requiredShots,
    optionalShots,
    boostRequiredShots,
    boostBonusShots,
    boostShots,
    loading,
  };
};

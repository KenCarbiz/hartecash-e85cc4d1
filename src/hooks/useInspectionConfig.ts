import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface InspectionConfig {
  id: string;
  dealership_id: string;
  section_tires: boolean;
  section_measurements: boolean;
  section_exterior: boolean;
  section_interior: boolean;
  section_mechanical: boolean;
  section_electrical: boolean;
  section_glass: boolean;
  section_order: string[];
  disabled_fields: Record<string, boolean>;
  show_tire_tread_depth: boolean;
  show_brake_pad_measurements: boolean;
  show_paint_readings: boolean;
  show_oil_life: boolean;
  show_battery_health: boolean;
  require_photos: Record<string, boolean>;
  require_notes: Record<string, boolean>;
  custom_items: { section: string; label: string; sort_order: number }[];
  default_inspection_mode: "standard" | "full";
  /**
   * @deprecated kept for back-compat with the AppraisalSidebar reader.
   * New code should use tire_input_mode and brake_input_mode below.
   */
  tire_brake_input_mode: "measurement" | "pass_fail";
  /** Tires-only input style. Replaces the legacy shared toggle. */
  tire_input_mode: "measurement" | "pass_fail";
  /** Brakes-only input style. Lets dealers pass/fail brakes while
   *  keeping exact tread-depth measurement on tires (or vice versa). */
  brake_input_mode: "measurement" | "pass_fail";
}

const DEFAULTS: InspectionConfig = {
  id: "",
  dealership_id: "default",
  section_tires: true,
  section_measurements: true,
  section_exterior: true,
  section_interior: true,
  section_mechanical: true,
  section_electrical: true,
  section_glass: true,
  section_order: ["tires", "measurements", "exterior", "interior", "mechanical", "electrical", "glass"],
  disabled_fields: {},
  show_tire_tread_depth: true,
  show_brake_pad_measurements: true,
  show_paint_readings: true,
  show_oil_life: true,
  show_battery_health: true,
  require_photos: {},
  require_notes: {},
  custom_items: [],
  default_inspection_mode: "standard",
  tire_brake_input_mode: "measurement",
  tire_input_mode: "measurement",
  brake_input_mode: "measurement",
};

/**
 * Resolves inspection config including the per-rooftop tire/brake
 * input-mode cascade.
 *
 * @param locationId — when provided, calls the
 *   effective_inspection_input_modes RPC to overlay any rooftop-
 *   specific overrides (set by admins via Setup · Dealer ·
 *   Inspection Sheet → Per-Rooftop Overrides) on top of the
 *   corporate inspection_config row. Pass the submission's
 *   store_location_id from InspectionSheet so multi-rooftop dealers
 *   render the right input modes per rooftop. When omitted, returns
 *   the corporate-tier values (matches the previous behavior).
 */
export const useInspectionConfig = (locationId?: string | null) => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const [config, setConfig] = useState<InspectionConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("inspection_config")
        .select("*")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (!data) {
        setLoading(false);
        return;
      }
      // Resolve per-type input modes with a per-rooftop cascade
      // overlay. Default to the legacy shared column when neither
      // the split columns nor the RPC are deployed yet.
      const legacyShared = (data.tire_brake_input_mode === "pass_fail" ? "pass_fail" : "measurement") as "measurement" | "pass_fail";
      let tireMode: "measurement" | "pass_fail" = (() => {
        const v = data.tire_input_mode;
        return v === "pass_fail" || v === "measurement" ? v : legacyShared;
      })();
      let brakeMode: "measurement" | "pass_fail" = (() => {
        const v = data.brake_input_mode;
        return v === "pass_fail" || v === "measurement" ? v : legacyShared;
      })();
      // When a location is in scope, layer the per-rooftop override
      // via the cascade RPC. Best-effort — fall back to corporate
      // values if the RPC isn't deployed (pre-migration environments).
      if (locationId) {
        try {
          const { data: rpcRows } = await supabase.rpc(
            "effective_inspection_input_modes",
            { _dealership_id: dealershipId, _location_id: locationId },
          );
          const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
          if (row?.tire_mode === "measurement" || row?.tire_mode === "pass_fail") {
            tireMode = row.tire_mode;
          }
          if (row?.brake_mode === "measurement" || row?.brake_mode === "pass_fail") {
            brakeMode = row.brake_mode;
          }
        } catch { /* RPC missing → corporate values stand */ }
      }
      setConfig({
        id: data.id,
        dealership_id: data.dealership_id,
        section_tires: data.section_tires,
        section_measurements: data.section_measurements,
        section_exterior: data.section_exterior,
        section_interior: data.section_interior,
        section_mechanical: data.section_mechanical,
        section_electrical: data.section_electrical,
        section_glass: data.section_glass,
        section_order: (data.section_order as string[] | null) || DEFAULTS.section_order,
        disabled_fields: (data.disabled_fields as Record<string, boolean> | null) || {},
        show_tire_tread_depth: data.show_tire_tread_depth,
        show_brake_pad_measurements: data.show_brake_pad_measurements,
        show_paint_readings: data.show_paint_readings,
        show_oil_life: data.show_oil_life,
        show_battery_health: data.show_battery_health,
        require_photos: (data.require_photos as Record<string, boolean> | null) || {},
        require_notes: (data.require_notes as Record<string, boolean> | null) || {},
        custom_items: (data.custom_items as unknown as CustomItem[] | null) || [],
        default_inspection_mode: (data.default_inspection_mode === "full" ? "full" : "standard") as "standard" | "full",
        tire_brake_input_mode: legacyShared,
        tire_input_mode: tireMode,
        brake_input_mode: brakeMode,
      });
      setLoading(false);
    };
    fetch();
  }, [dealershipId, locationId]);

  return { config, loading };
};

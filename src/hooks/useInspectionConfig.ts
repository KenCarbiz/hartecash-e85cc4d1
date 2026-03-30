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
};

export const useInspectionConfig = () => {
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
      if (data) {
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
          section_order: (data.section_order as any) || DEFAULTS.section_order,
          disabled_fields: (data.disabled_fields as any) || {},
          show_tire_tread_depth: data.show_tire_tread_depth,
          show_brake_pad_measurements: data.show_brake_pad_measurements,
          show_paint_readings: data.show_paint_readings,
          show_oil_life: data.show_oil_life,
          show_battery_health: data.show_battery_health,
          require_photos: (data.require_photos as any) || {},
          require_notes: (data.require_notes as any) || {},
          custom_items: (data.custom_items as any) || [],
          default_inspection_mode: ((data as any).default_inspection_mode === "full" ? "full" : "standard") as "standard" | "full",
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return { config, loading };
};

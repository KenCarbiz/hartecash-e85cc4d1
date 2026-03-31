import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhotoShot {
  id: string;
  shot_id: string;
  label: string;
  description: string;
  orientation: string;
  is_enabled: boolean;
  is_required: boolean;
  sort_order: number;
}

/**
 * Fetches photo configuration for a dealership.
 * Falls back to 'default' dealership config if none found for the given ID.
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
        setShots(data.map(d => ({
          id: d.id,
          shot_id: d.shot_id,
          label: d.label,
          description: d.description,
          orientation: d.orientation,
          is_enabled: d.is_enabled,
          is_required: d.is_required,
          sort_order: d.sort_order,
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [dealershipId]);

  const enabledShots = shots.filter(s => s.is_enabled);
  const requiredShots = enabledShots.filter(s => s.is_required);
  const optionalShots = enabledShots.filter(s => !s.is_required);

  return { shots, enabledShots, requiredShots, optionalShots, loading };
};

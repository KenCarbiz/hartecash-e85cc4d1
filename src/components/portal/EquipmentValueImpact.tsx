import { useEffect, useState } from "react";
import { Settings2, TrendingUp, TrendingDown, CheckCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface AddDeduct {
  uoc: string;
  name: string;
  auto: string;
  avg: number;
  clean: number;
  rough: number;
  xclean: number;
}

interface EquipmentValueImpactProps {
  submissionId: string;
}

const EquipmentValueImpact = ({ submissionId }: EquipmentValueImpactProps) => {
  const [equipment, setEquipment] = useState<AddDeduct[]>([]);
  const [selectedUocs, setSelectedUocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("submissions")
        .select("bb_add_deducts, bb_selected_options")
        .eq("id", submissionId)
        .maybeSingle();

      if (data) {
        try {
          const deducts: AddDeduct[] = Array.isArray(data.bb_add_deducts)
            ? data.bb_add_deducts
            : typeof data.bb_add_deducts === "string"
              ? JSON.parse(data.bb_add_deducts)
              : [];
          setEquipment(deducts);
        } catch { /* ignore */ }
        setSelectedUocs(data.bb_selected_options || []);
      }
      setLoading(false);
    };
    fetch();
  }, [submissionId]);

  if (loading || equipment.length === 0) return null;

  // Only show equipment that affects value (auto="Y" from VIN or customer-selected)
  const activeItems = equipment.filter(
    (e) => e.auto === "Y" || e.auto === "M" || selectedUocs.includes(e.uoc)
  );

  if (activeItems.length === 0) return null;

  const totalImpact = activeItems.reduce((sum, e) => sum + e.avg, 0);
  const positiveItems = activeItems.filter((e) => e.avg > 0);
  const negativeItems = activeItems.filter((e) => e.avg < 0);
  const neutralItems = activeItems.filter((e) => e.avg === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-card-foreground">Equipment & Options</h3>
          </div>
          <span className={`text-sm font-bold ${totalImpact >= 0 ? "text-green-600" : "text-destructive"}`}>
            {totalImpact >= 0 ? "+" : ""}${Math.abs(totalImpact).toLocaleString()} impact
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Verified factory options that affect your vehicle's value
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* Value-adding options */}
        {positiveItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Adds Value</p>
            </div>
            <div className="space-y-1">
              {positiveItems.map((item) => (
                <div key={item.uoc} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-green-500/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <span className="text-xs text-card-foreground truncate">{item.name}</span>
                    {selectedUocs.includes(item.uoc) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">
                        You Selected
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-green-600 shrink-0 ml-2">
                    +${item.avg.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Value-reducing options */}
        {negativeItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Adjustments</p>
            </div>
            <div className="space-y-1">
              {negativeItems.map((item) => (
                <div key={item.uoc} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-destructive/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-card-foreground truncate">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-destructive shrink-0 ml-2">
                    -${Math.abs(item.avg).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Neutral / included */}
        {neutralItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Included in Base Value</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {neutralItems.map((item) => (
                <span key={item.uoc} className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Total summary bar */}
        <div className="mt-2 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total Equipment Value Impact</span>
          <span className={`text-sm font-bold ${totalImpact >= 0 ? "text-green-600" : "text-destructive"}`}>
            {totalImpact >= 0 ? "+" : ""}${Math.abs(totalImpact).toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default EquipmentValueImpact;

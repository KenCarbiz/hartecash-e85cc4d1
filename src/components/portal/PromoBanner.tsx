import { useState, useEffect } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Promo {
  name: string;
  description: string | null;
  bonus_amount: number;
}

interface PromoBannerProps {
  dealershipId: string;
}

const PromoBanner = ({ dealershipId }: PromoBannerProps) => {
  const [promo, setPromo] = useState<Promo | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("promotions")
        .select("name, description, bonus_amount")
        .eq("dealership_id", dealershipId)
        .eq("is_active", true)
        .eq("show_on_portal", true)
        .lte("starts_at", now)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("bonus_amount", { ascending: false })
        .limit(1);

      if (data && data.length > 0) setPromo(data[0]);
    };
    fetch();
  }, [dealershipId]);

  if (!promo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-success/30 bg-gradient-to-r from-success/10 via-success/5 to-accent/10 p-4"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-success">
                Limited Time Bonus
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">{promo.name}</p>
            {promo.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{promo.description}</p>
            )}
            <div className="mt-2 inline-flex items-center gap-1.5 bg-success/15 text-success rounded-lg px-3 py-1">
              <Megaphone className="w-3.5 h-3.5" />
              <span className="text-sm font-bold">+${promo.bonus_amount.toLocaleString()} Bonus</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PromoBanner;

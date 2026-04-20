import { useState } from "react";
import { Bell, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubmissionLite {
  id: string;
  dealership_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vin: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage: number | null;
  overall_condition: string | null;
}

interface Props {
  submission: SubmissionLite;
  baselineValue: number;
}

/**
 * "Watch My Car's Worth" opt-in CTA for the offer page.
 *
 * Pitched on the offer page as: "Not ready to sell? We'll track your car's
 * value and let you know when it changes." Creates a watched_vehicles row,
 * generates a token for the customer dashboard, and confirms with a toast.
 *
 * No competitor offers this — first-party retention loop.
 */
const WatchMyCarCTA = ({ submission, baselineValue }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const handleSave = async () => {
    if (!submission.email) {
      toast({
        title: "Email needed",
        description: "We need an email to send your value updates.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const newToken = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("watched_vehicles" as any).insert({
      dealership_id: submission.dealership_id,
      token: newToken,
      submission_id: submission.id,
      customer_name: submission.name,
      email: submission.email,
      phone: submission.phone,
      vin: submission.vin,
      vehicle_year: submission.vehicle_year ? parseInt(submission.vehicle_year) : null,
      vehicle_make: submission.vehicle_make,
      vehicle_model: submission.vehicle_model,
      mileage_at_save: submission.mileage || 0,
      overall_condition: submission.overall_condition,
      baseline_value: baselineValue,
      current_value: baselineValue,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setToken(newToken);
    setSaved(true);
    toast({
      title: "Watching your car",
      description: "We'll email you when the value changes.",
    });
  };

  if (saved) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-success font-bold mb-1">
          <Check className="w-5 h-5" />
          You're watching this car
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          We'll email you when the value moves more than $200.
        </p>
        {token && (
          <a
            href={`/watch-my-car/${token}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline"
          >
            View your tracker →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-card-foreground">Not ready to sell yet?</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            We'll track your car's value over time and let you know when it changes.
            No spam — just a heads-up when the market moves.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-4 py-2 rounded-full transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Watch my car's worth
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchMyCarCTA;

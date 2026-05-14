import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState } from "../types";
import { cn } from "@/lib/utils";

type Location = { id: string; name: string; city: string | null; state: string | null; address: string | null };

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const dateValue = (d: Date) => d.toISOString().slice(0, 10);

const TIME_SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

const MotoStepSchedule = ({
  state,
}: {
  state: MotoFlowState;
}) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const upcomingDays = useMemo(() => {
    const out: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i + 1);
      out.push(d);
    }
    return out;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("dealership_locations")
        .select("id, name, city, state, address")
        .eq("dealership_id", tenant.dealership_id)
        .eq("show_in_scheduling", true)
        .order("name");
      if (cancelled) return;
      const rows = (data ?? []) as Location[];
      setLocations(rows);
      if (rows.length === 1) setLocationId(rows[0].id);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id]);

  const submit = async () => {
    if (!state.submissionToken) {
      toast({ title: "Missing submission token", variant: "destructive" });
      return;
    }
    const loc = locations.find((l) => l.id === locationId);
    if (!loc || !date || !time) {
      toast({ title: "Pick a location, date, and time", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("book-appointment", {
        body: {
          submission_token: state.submissionToken,
          appointment_date: date,
          appointment_time: time,
          location_name: loc.name,
          customer_name: `${state.contact.firstName} ${state.contact.lastName}`.trim(),
          customer_email: state.contact.email,
          reason: "initial_appointment",
        },
      });
      if (error || !(data as { success?: boolean })?.success) {
        toast({
          title: "Couldn't book that slot",
          description: (data as { message?: string })?.message || "Try a different time.",
          variant: "destructive",
        });
        return;
      }
      setConfirmation((data as { confirmation_number?: string }).confirmation_number || "Confirmed");
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <>
        <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
        <MotoCard>
          <div className="py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="mt-3 text-xl font-bold text-zinc-900">You're all set</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Confirmation <span className="font-semibold">{confirmation}</span>
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              We've sent the details to {state.contact.email || "your email"}. See you on{" "}
              <span className="font-medium text-zinc-700">{formatDate(new Date(date))}</span> at{" "}
              <span className="font-medium text-zinc-700">{time}</span>.
            </p>
          </div>
        </MotoCard>
      </>
    );
  }

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="Schedule Your Inspection">
        {locations.length > 1 ? (
          <div className="mb-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Location</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-[hsl(var(--cta-offer))]"
              >
                <option value="">Choose a store</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.city ? ` — ${l.city}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <p className="mb-2 text-xs font-medium text-zinc-600">Date</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {upcomingDays.map((d) => {
            const v = dateValue(d);
            return (
              <button
                key={v}
                type="button"
                onClick={() => setDate(v)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  date === v
                    ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer)/0.08)] font-semibold text-zinc-900"
                    : "border-zinc-200 text-zinc-700 hover:border-zinc-300",
                )}
              >
                {formatDate(d)}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs font-medium text-zinc-600">Time</p>
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                time === t
                  ? "border-[hsl(var(--cta-offer))] bg-[hsl(var(--cta-offer)/0.08)] font-semibold text-zinc-900"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-300",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </MotoCard>
      <div className="mt-5">
        <MotoPrimaryButton
          disabled={!locationId || !date || !time || submitting}
          loading={submitting}
          onClick={submit}
        >
          Confirm Appointment
        </MotoPrimaryButton>
      </div>
    </>
  );
};

export default MotoStepSchedule;

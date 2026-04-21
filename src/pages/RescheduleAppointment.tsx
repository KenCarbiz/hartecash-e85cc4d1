import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, CheckCircle2, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import SEO from "@/components/SEO";

/**
 * RescheduleAppointment — self-serve reschedule page reached from the
 * link inside a reminder SMS. Customer taps the link, sees their
 * current slot, and either confirms or picks a new one.
 *
 * Design goals:
 *   - Zero-login: authenticated only by the opaque reschedule_token
 *   - Under 60 seconds start-to-finish on mobile
 *   - Fallback to phone call if no slots work (tel: link to dealer)
 *
 * ?action=confirm auto-confirms without showing reschedule picker.
 * This lets the reminder SMS template offer a "Tap to confirm" CTA
 * that distinct from "Need to reschedule?".
 */

interface Appointment {
  id: string;
  scheduled_at: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  location: string | null;
  store_location: string | null;
  status: string;
  confirmed_at: string | null;
  rescheduled_at: string | null;
  dealership_id: string | null;
}

interface DealershipInfo {
  display_name: string;
  phone: string | null;
}

const RescheduleAppointment = () => {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const action = params.get("action"); // "confirm" to auto-confirm

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [dealer, setDealer] = useState<DealershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmedJustNow, setConfirmedJustNow] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submittingPick, setSubmittingPick] = useState(false);
  const [rescheduledJustNow, setRescheduledJustNow] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, preferred_date, preferred_time, location, store_location, status, confirmed_at, rescheduled_at, dealership_id")
        .eq("reschedule_token", token)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setError("We couldn't find this appointment. The link may have expired — call the dealership to reschedule.");
        setLoading(false);
        return;
      }
      setAppt(data as any);
      // Pull dealership display name + phone for the header and the
      // "call instead" fallback.
      if ((data as any).dealership_id) {
        const { data: t } = await supabase
          .from("tenants")
          .select("display_name")
          .eq("dealership_id", (data as any).dealership_id)
          .maybeSingle();
        const { data: site } = await supabase
          .from("site_config")
          .select("contact_phone")
          .eq("dealership_id", (data as any).dealership_id)
          .maybeSingle();
        if (!cancelled) {
          setDealer({
            display_name: (t as any)?.display_name || "the dealership",
            phone: (site as any)?.contact_phone ?? null,
          });
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Auto-confirm path from the SMS "Tap to confirm" button.
  useEffect(() => {
    if (action === "confirm" && appt && !appt.confirmed_at && !confirmedJustNow && !confirming) {
      handleConfirm();
    }

  }, [action, appt]);

  const prettyDate = useMemo(() => {
    if (!appt) return "";
    if (appt.scheduled_at) {
      const d = new Date(appt.scheduled_at);
      return d.toLocaleString(undefined, {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    }
    if (appt.preferred_date && appt.preferred_time) {
      return `${new Date(appt.preferred_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at ${appt.preferred_time}`;
    }
    return "";
  }, [appt]);

  const handleConfirm = async () => {
    if (!appt) return;
    setConfirming(true);
    const { error } = await supabase
      .from("appointments")
      .update({ confirmed_at: new Date().toISOString() } as any)
      .eq("id", appt.id);
    setConfirming(false);
    if (error) {
      setError("Could not save your confirmation. Please call the dealership.");
      return;
    }
    setConfirmedJustNow(true);
  };

  const handlePickOpen = () => setPicking(true);
  const handlePickCancel = () => {
    setPicking(false);
    setSelectedSlot(null);
  };

  const proposedSlots = useMemo(() => generateUpcomingSlots(), []);

  const handleSubmitPick = async () => {
    if (!appt || !selectedSlot) return;
    setSubmittingPick(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        scheduled_at: selectedSlot,
        rescheduled_at: new Date().toISOString(),
        rescheduled_from: appt.scheduled_at,
        // Null the sent timestamps so the new time gets its own 24h/2h cadence.
        reminder_24h_sent_at: null,
        reminder_2h_sent_at: null,
      } as any)
      .eq("id", appt.id);
    if (error) {
      setError("Could not save the new time. Please call the dealership.");
      setSubmittingPick(false);
      return;
    }
    // Notify the dealership that the customer self-served.
    safeInvoke("send-reschedule-notification", {
      body: { appointment_id: appt.id, new_scheduled_at: selectedSlot },
      context: { from: "RescheduleAppointment.submit" },
    });
    setSubmittingPick(false);
    setRescheduledJustNow(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-base font-semibold text-card-foreground mb-2">{error}</p>
          {dealer?.phone && (
            <a href={`tel:${dealer.phone}`} className="inline-block mt-4 underline text-primary font-semibold">
              Call {dealer.display_name}: {dealer.phone}
            </a>
          )}
        </div>
      </div>
    );
  }

  const showConfirmedScreen = confirmedJustNow || (appt?.confirmed_at && !picking && !rescheduledJustNow);
  const showRescheduledScreen = rescheduledJustNow;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEO title="Your Appointment" />
      <main className="max-w-md mx-auto px-4 py-10">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-xl">
          <h1 className="text-xl font-bold text-card-foreground mb-1">
            {dealer?.display_name || "Your appointment"}
          </h1>
          <p className="text-sm text-muted-foreground mb-5">Vehicle trade-in inspection</p>

          {/* Current slot */}
          <div className="rounded-2xl bg-muted/40 border border-border/40 p-4 space-y-2 mb-5">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-card-foreground">{prettyDate}</span>
            </div>
            {(appt?.location || appt?.store_location) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{appt?.location || appt?.store_location}</span>
              </div>
            )}
            {appt?.confirmed_at && (
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmed</span>
              </div>
            )}
          </div>

          {showRescheduledScreen && (
            <div className="rounded-2xl bg-success/10 border border-success/30 p-4 text-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="font-semibold text-card-foreground">New time booked</p>
              <p className="text-xs text-muted-foreground mt-1">
                We'll send a confirmation text. See you then.
              </p>
            </div>
          )}

          {showConfirmedScreen && !showRescheduledScreen && (
            <div className="rounded-2xl bg-success/10 border border-success/30 p-4 text-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
              <p className="font-semibold text-card-foreground">You're all set</p>
              <p className="text-xs text-muted-foreground mt-1">
                See you {prettyDate.toLowerCase().includes(" at ") ? "then" : "soon"}.
              </p>
            </div>
          )}

          {/* Reschedule picker */}
          {picking && !rescheduledJustNow && (
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-card-foreground">Pick a new time</p>
                <button onClick={handlePickCancel} className="text-xs text-muted-foreground hover:text-card-foreground flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                {proposedSlots.map((iso) => {
                  const d = new Date(iso);
                  const isSelected = selectedSlot === iso;
                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedSlot(iso)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-card-foreground">
                        {d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={handleSubmitPick}
                disabled={!selectedSlot || submittingPick}
                className="w-full h-12 text-base font-bold"
              >
                {submittingPick ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {submittingPick ? "Saving…" : "Confirm new time"}
              </Button>
            </div>
          )}

          {/* Action buttons */}
          {!picking && !showConfirmedScreen && !showRescheduledScreen && (
            <div className="space-y-2.5">
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full h-12 text-base font-bold"
              >
                {confirming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                {confirming ? "Confirming…" : "I'll be there"}
              </Button>
              <Button
                onClick={handlePickOpen}
                variant="outline"
                className="w-full h-12 text-base font-semibold"
              >
                <CalendarDays className="w-5 h-5 mr-2" />
                Pick a different time
              </Button>
              {dealer?.phone && (
                <a
                  href={`tel:${dealer.phone}`}
                  className="block text-center text-xs text-muted-foreground underline pt-2"
                >
                  Or call {dealer.display_name}: {dealer.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Generate proposed slots: next 7 days × 9am/11am/1pm/3pm/5pm,
// skipping past times. Simple heuristic — dealer-specific hours can
// be wired from dealership_locations.hours later.
function generateUpcomingSlots(): string[] {
  const slots: string[] = [];
  const now = new Date();
  for (let day = 0; day < 7; day++) {
    for (const hour of [9, 11, 13, 15, 17]) {
      const d = new Date(now);
      d.setDate(d.getDate() + day);
      d.setHours(hour, 0, 0, 0);
      if (d.getTime() > now.getTime() + 2 * 60 * 60 * 1000) {
        slots.push(d.toISOString());
      }
    }
  }
  return slots;
}

export default RescheduleAppointment;

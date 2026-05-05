import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, CheckCircle, Loader2, AlertCircle, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";

/**
 * Clarity-tier reschedule page — Apple-minimal companion to the
 * other Clarity customer-journey pages. Mounted by
 * RescheduleAppointment.tsx as a top-level dispatch when the dealer's
 * landing_template is "clarity".
 *
 * Same three-state UX as the legacy page: pristine (confirm or pick
 * new time), picking (slot grid), confirmed/rescheduled (success).
 * Authenticated only by the opaque reschedule_token in the URL.
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

const RescheduleAppointmentClarity = () => {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const action = params.get("action");
  const { config } = useSiteConfig();

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
      const { data, error: rpcErr } = await (supabase as any)
        .from("appointments")
        .select("id, scheduled_at, preferred_date, preferred_time, location, store_location, status, confirmed_at, rescheduled_at, dealership_id")
        .eq("reschedule_token", token)
        .maybeSingle();
      if (cancelled) return;
      if (rpcErr || !data) {
        setError("We couldn't find this appointment. The link may have expired.");
        setLoading(false);
        return;
      }
      setAppt(data as Appointment);
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
            display_name: (t as any)?.display_name || config.dealership_name || "the dealership",
            phone: (site as any)?.contact_phone ?? config.phone ?? null,
          });
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-confirm path from "Tap to confirm" SMS button.
  useEffect(() => {
    if (action === "confirm" && appt && !appt.confirmed_at && !confirmedJustNow && !confirming) {
      handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, appt]);

  const prettyDate = useMemo(() => {
    if (!appt) return "";
    if (appt.scheduled_at) {
      return new Date(appt.scheduled_at).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (appt.preferred_date && appt.preferred_time) {
      return `${new Date(appt.preferred_date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })} at ${appt.preferred_time}`;
    }
    return "";
  }, [appt]);

  const handleConfirm = async () => {
    if (!appt) return;
    setConfirming(true);
    const { error: updErr } = await supabase
      .from("appointments")
      .update({ confirmed_at: new Date().toISOString() } as any)
      .eq("id", appt.id);
    setConfirming(false);
    if (updErr) {
      setError("Could not save your confirmation. Please call the dealership.");
      return;
    }
    setConfirmedJustNow(true);
  };

  const proposedSlots = useMemo(() => generateUpcomingSlots(), []);

  const handleSubmitPick = async () => {
    if (!appt || !selectedSlot) return;
    setSubmittingPick(true);
    const { error: updErr } = await supabase
      .from("appointments")
      .update({
        scheduled_at: selectedSlot,
        rescheduled_at: new Date().toISOString(),
        rescheduled_from: appt.scheduled_at,
        reminder_24h_sent_at: null,
        reminder_2h_sent_at: null,
      } as any)
      .eq("id", appt.id);
    if (updErr) {
      setError("Could not save the new time. Please call the dealership.");
      setSubmittingPick(false);
      return;
    }
    safeInvoke("send-reschedule-notification", {
      body: { appointment_id: appt.id, new_scheduled_at: selectedSlot },
      context: { from: "RescheduleAppointmentClarity.submit" },
    });
    setSubmittingPick(false);
    setRescheduledJustNow(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900 px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-zinc-400 mx-auto" aria-hidden="true" />
          <p className="text-base font-semibold text-zinc-900">{error}</p>
          {dealer?.phone && (
            <a
              href={`tel:${dealer.phone}`}
              className="inline-block text-sm font-semibold underline text-zinc-900 hover:text-zinc-600 transition-colors"
            >
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
    <div className="min-h-screen bg-white text-zinc-900">
      <SEO title="Your Appointment" />
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-[640px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.dealership_name} className="h-9 md:h-11 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">
                {config.dealership_name}
              </span>
            )}
          </Link>
          {dealer?.phone && (
            <a
              href={`tel:${dealer.phone}`}
              className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {dealer.phone}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-[560px] mx-auto px-5 md:px-8 py-12 md:py-14 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Your appointment
          </p>
          <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
            {dealer?.display_name || "Your appointment"}
          </h1>
          <p className="text-sm text-zinc-500">Vehicle inspection</p>
        </motion.section>

        {/* Current slot card */}
        <section
          aria-label="Current appointment time"
          className="rounded-3xl border border-zinc-200 bg-zinc-50/40 p-6 space-y-3"
        >
          <div className="flex items-center gap-2.5 text-sm">
            <Calendar className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-zinc-900">{prettyDate}</span>
          </div>
          {(appt?.location || appt?.store_location) && (
            <div className="flex items-center gap-2.5 text-sm text-zinc-500">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{appt?.location || appt?.store_location}</span>
            </div>
          )}
          {appt?.confirmed_at && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-semibold">Confirmed</span>
            </div>
          )}
        </section>

        {/* Success states */}
        {(showRescheduledScreen || showConfirmedScreen) && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center"
          >
            <CheckCircle className="w-9 h-9 text-emerald-500 mx-auto mb-2" aria-hidden="true" />
            <p className="font-bold text-zinc-900">
              {showRescheduledScreen ? "New time booked" : "You're all set"}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              {showRescheduledScreen
                ? "We'll text you a confirmation. See you then."
                : "See you soon."}
            </p>
          </motion.section>
        )}

        {/* Reschedule picker */}
        {picking && !rescheduledJustNow && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Pick a new time
              </p>
              <button
                onClick={() => {
                  setPicking(false);
                  setSelectedSlot(null);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" aria-hidden="true" /> Cancel
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
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 bg-white hover:border-zinc-400"
                    }`}
                  >
                    <Clock className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-zinc-900">
                      {d.toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              onClick={handleSubmitPick}
              disabled={!selectedSlot || submittingPick}
              className="w-full h-12 rounded-full text-base font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100"
            >
              {submittingPick ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Saving…
                </>
              ) : (
                "Confirm new time"
              )}
            </Button>
          </section>
        )}

        {/* Action buttons (pristine state) */}
        {!picking && !showConfirmedScreen && !showRescheduledScreen && (
          <section className="space-y-3">
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full h-12 rounded-full text-base font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100"
              style={
                config.landing_cta_color
                  ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                  : undefined
              }
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Confirming…
                </>
              ) : (
                "I'll be there"
              )}
            </Button>
            <Button
              onClick={() => setPicking(true)}
              variant="outline"
              className="w-full h-12 rounded-full text-base font-semibold border-zinc-200 text-zinc-900 hover:bg-zinc-50"
            >
              Pick a different time
            </Button>
            {dealer?.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="block text-center text-xs text-zinc-500 hover:text-zinc-900 underline pt-2 transition-colors"
              >
                Or call {dealer.display_name}: {dealer.phone}
              </a>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

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

export default RescheduleAppointmentClarity;

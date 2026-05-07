import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Check, ExternalLink, Loader2, MapPin, Phone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Customer self check-in page — mirrors the Hartford Toyota
 * design template (Customer Check-In.html). Three states drive
 * the layout:
 *
 *   BEFORE    — initial visit (no status query, status is anything
 *                pre-arrival). Two buttons: "I'm on my way" / "I'm here"
 *   ON THE WAY — customer tapped "I'm on my way" or arrived via
 *                ?status=on_the_way. Confirmation card + single
 *                "I'm here now" CTA, "we know you're coming" pill.
 *   ARRIVED   — checked in. Big green check, sales-manager profile
 *                card, "stay in your car" advisory.
 *
 * Hydrated by the get_customer_arrival_page RPC in one round-trip.
 * The customer is unauthenticated; the URL token is the auth model
 * (same pattern as /offer/:token, /upload/:token, /docs/:token).
 */

interface ArrivalData {
  submission_id: string;
  customer_first_name: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_trim: string | null;
  plate: string | null;
  vin_last6: string | null;
  appointment_date: string;
  appointment_time: string;
  progress_status: string;
  self_checkin_at: string | null;
  self_checkin_status: string | null;
  dealership_id: string;
  dealership_name: string;
  salesperson_name: string;
}

type View = "before" | "on_the_way" | "arrived";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

const fmtAppt = (date: string, time: string) => {
  if (!date && !time) return "Today · soon";
  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = !date
    ? "Today"
    : date === today
      ? "Today"
      : new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
  return time ? `${dayLabel} · ${time}` : dayLabel;
};

const VehicleAndApptCards = ({ data }: { data: ArrivalData }) => {
  const vehicleTitle = [data.vehicle_year, data.vehicle_make, data.vehicle_model]
    .filter(Boolean)
    .join(" ");
  const trimSuffix = data.vehicle_trim ? ` ${data.vehicle_trim}` : "";
  const plateLine = [
    data.plate ? `CT ${data.plate.toUpperCase()}` : null,
    data.vin_last6 ? `…${data.vin_last6}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-3">
      {/* Vehicle card */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Car className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Your vehicle
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">
            {vehicleTitle || "Your vehicle"}{trimSuffix}
          </div>
          {plateLine && (
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums truncate">
              {plateLine}
            </div>
          )}
        </div>
      </div>

      {/* Appointment card */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Appointment
          </div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">
            {fmtAppt(data.appointment_date, data.appointment_time)}
          </div>
        </div>
        {data.salesperson_name && (
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              With
            </div>
            <div className="text-sm font-bold text-slate-900">
              {data.salesperson_name}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const GettingHere = ({ dealerName, dealerPhone, dealerAddress }: {
  dealerName: string;
  dealerPhone?: string;
  dealerAddress?: string;
}) => (
  <div className="space-y-2 pt-1">
    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 px-1">
      Getting here
    </div>
    {dealerAddress && (
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(dealerAddress)}`}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition"
      >
        <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">Directions</div>
          <div className="text-[12px] text-slate-500 truncate">{dealerAddress}</div>
        </div>
      </a>
    )}
    {dealerPhone && (
      <a
        href={`tel:${dealerPhone}`}
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition"
      >
        <Phone className="w-4 h-4 text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">Call {dealerName || "the dealership"}</div>
          <div className="text-[12px] text-slate-500 tabular-nums">{dealerPhone}</div>
        </div>
      </a>
    )}
  </div>
);

const CustomerArrival = () => {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const { config } = useSiteConfig();
  const [data, setData] = useState<ArrivalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(null);

  const accent = config.landing_cta_color || "#1e6aa8";
  const dealerName = data?.dealership_name || config.dealership_name || "the dealership";
  const dealerPhone = (config as { dealership_phone?: string }).dealership_phone;
  const dealerAddress = (config as { dealership_address?: string }).dealership_address;

  const fetchData = async () => {
    if (!token) return;
    const { data: rows, error } = await supabase.rpc(
      "get_customer_arrival_page",
      { _token: token } as never,
    );
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        setErrorMsg("Self check-in isn't enabled yet for this dealership. The front desk will check you in when you arrive.");
      } else {
        setErrorMsg("We couldn't find your appointment. Reach out to the dealership and we'll get you sorted.");
      }
      setLoading(false);
      return;
    }
    const row = (rows as ArrivalData[] | null)?.[0] || null;
    if (!row) {
      setErrorMsg("We couldn't find your appointment. Reach out to the dealership and we'll get you sorted.");
      setLoading(false);
      return;
    }
    setData(row);
    setLoading(false);
  };

  // Initial fetch + auto-fire if URL has ?status=
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!data || submitting) return;
    const initial = search.get("status");
    if ((initial === "on_the_way" || initial === "arrived") && data.progress_status !== "customer_arrived") {
      // Don't override an already-arrived state with on_the_way regress.
      if (initial === "on_the_way" && data.progress_status === "on_the_way") return;
      void submit(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const submit = async (status: "on_the_way" | "arrived") => {
    if (!token) return;
    setSubmitting(true);
    const { error } = await supabase.rpc(
      "customer_self_checkin",
      { _token: token, _status: status } as never,
    );
    setSubmitting(false);
    if (error) {
      setErrorMsg("Something went sideways. Try again or walk up to the front desk.");
      return;
    }
    setConfirmedAt(new Date());
    void fetchData();
  };

  // Decide which view to render from current state.
  const view: View = useMemo(() => {
    if (!data) return "before";
    if (data.progress_status === "customer_arrived") return "arrived";
    if (data.progress_status === "on_the_way") return "on_the_way";
    return "before";
  }, [data]);

  // ── Loading / error states ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warning/15 text-warning">
            <Car className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">We hit a snag</h1>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const firstName = data.customer_first_name || "there";

  // ── Background tint per state — matches the design ──────────────
  const bgClass =
    view === "arrived"
      ? "bg-gradient-to-b from-emerald-50 via-emerald-50/40 to-white"
      : view === "on_the_way"
        ? "bg-gradient-to-b from-sky-50 via-sky-50/40 to-white"
        : "bg-gradient-to-b from-slate-50 to-white";

  return (
    <div className={`min-h-screen ${bgClass} px-5 py-8`}>
      <div className="max-w-md mx-auto space-y-5">
        {/* Dealership header */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black text-white" style={{ background: accent }}>
            {(dealerName || "HT").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
            {dealerName}
          </div>
        </div>

        {/* ── BEFORE ── */}
        {view === "before" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="text-center pt-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
                Hi, {firstName}
              </div>
              <h1 className="font-serif text-3xl leading-[1.1] tracking-tight text-slate-900">
                On your way to<br />{dealerName}?
              </h1>
              <p className="text-sm text-slate-600 mt-3 max-w-xs mx-auto">
                Tap below so we can have everything ready for you.
              </p>
            </div>

            <VehicleAndApptCards data={data} />

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => submit("on_the_way")}
                disabled={submitting}
                className="w-full h-14 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2 border-2 transition active:scale-[0.99] disabled:opacity-50"
                style={{ borderColor: accent, color: accent }}
              >
                <ExternalLink className="w-5 h-5" />
                I'm on my way
              </button>
              <button
                type="button"
                onClick={() => submit("arrived")}
                disabled={submitting}
                className="w-full h-14 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2 bg-success text-success-foreground hover:brightness-105 transition active:scale-[0.99] disabled:opacity-50"
              >
                <MapPin className="w-5 h-5" />
                I'm here
              </button>
              <p className="text-center text-[11px] text-slate-500 pt-1">
                {data.salesperson_name
                  ? `${data.salesperson_name} will get a text the moment you tap.`
                  : "We'll get the team ready the moment you tap."}
              </p>
            </div>

            <GettingHere dealerName={dealerName} dealerPhone={dealerPhone} dealerAddress={dealerAddress} />
          </motion.div>
        )}

        {/* ── ON THE WAY ── */}
        {view === "on_the_way" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-[11px] font-bold uppercase tracking-wider mb-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                We know you're coming
              </div>
              <h1 className="font-serif text-3xl leading-[1.1] tracking-tight text-slate-900">
                See you soon, {firstName}.
              </h1>
              <p className="text-sm text-slate-600 mt-3 max-w-xs mx-auto">
                {data.salesperson_name
                  ? `${data.salesperson_name}'s been notified. Tap "I'm here" when you pull onto the lot.`
                  : `The team's been notified. Tap "I'm here" when you pull onto the lot.`}
              </p>
            </div>

            <VehicleAndApptCards data={data} />

            {/* Confirmation card */}
            <div className="rounded-2xl border border-success/30 bg-success/5 px-4 py-3.5 flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-success text-success-foreground flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">
                  We let {data.salesperson_name?.split(" ")[0] || "the team"} know
                </div>
                {confirmedAt && (
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Sent {Math.max(1, Math.round((Date.now() - confirmedAt.getTime()) / 1000))} seconds ago
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => submit("arrived")}
              disabled={submitting}
              className="w-full h-14 rounded-2xl text-base font-bold inline-flex items-center justify-center gap-2 bg-success text-success-foreground hover:brightness-105 transition active:scale-[0.99] disabled:opacity-50"
            >
              <MapPin className="w-5 h-5" />
              I'm here now
            </button>
            <p className="text-center text-[11px] text-slate-500 -mt-1">
              Tap this when you pull onto the lot.
            </p>

            <GettingHere dealerName={dealerName} dealerPhone={dealerPhone} dealerAddress={dealerAddress} />
          </motion.div>
        )}

        {/* ── ARRIVED ── */}
        {view === "arrived" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="text-center pt-4">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success text-success-foreground"
              >
                <Check className="w-10 h-10" strokeWidth={3} />
              </motion.div>
              <h1 className="font-serif text-3xl leading-[1.1] tracking-tight text-slate-900 mt-5">
                You're checked in
              </h1>
              <p className="text-sm text-slate-600 mt-3 max-w-xs mx-auto">
                {data.salesperson_name
                  ? `${data.salesperson_name} has been notified and is heading out to meet you.`
                  : "Someone will be right with you."}
              </p>
            </div>

            <VehicleAndApptCards data={data} />

            {/* Live status / salesperson card */}
            {data.salesperson_name && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="bg-emerald-50/40 border-b border-emerald-100 px-4 py-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                    </span>
                    Live
                  </div>
                  <div className="text-[10px] text-slate-500">Updated just now</div>
                </div>
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-[13px] font-black text-slate-700 shrink-0">
                    {initialsOf(data.salesperson_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {data.salesperson_name}
                    </div>
                    <div className="text-[12px] text-slate-500 truncate">
                      Your sales contact
                    </div>
                    <div className="text-[11px] text-success font-semibold mt-0.5 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      On the way · ~2 min
                    </div>
                  </div>
                  {dealerPhone && (
                    <a
                      href={`tel:${dealerPhone}`}
                      className="w-10 h-10 rounded-full bg-success text-success-foreground flex items-center justify-center shrink-0 hover:brightness-105 transition"
                      aria-label="Call the dealership"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* "Stay in your car" advisory */}
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div className="flex-1 text-[13px] leading-relaxed">
                <div className="font-bold text-slate-900">
                  Stay in your car — {data.salesperson_name?.split(" ")[0] || "your contact"} is walking out now.
                </div>
                <div className="text-slate-600 mt-0.5">
                  Pull up to the service drive or park in any visitor spot.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CustomerArrival;

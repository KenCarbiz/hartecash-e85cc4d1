import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, MapPin, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logConsent } from "@/lib/consent";
import { safeInvoke } from "@/lib/safeInvoke";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { track } from "@/lib/analytics";
import {
  generateICalEvent,
  downloadCalendarInvite,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from "@/lib/calendarInvite";

/**
 * Clarity-tier schedule visit page — Apple-minimal companion to
 * ClarityTemplate, OfferPageClarity, CustomerPortalClarity, and
 * DealAcceptedClarity. Mounted by ScheduleVisit.tsx as a top-level
 * dispatch when the dealer's landing_template is "clarity".
 *
 * Scope: name, email, phone, date, time, location (or mobile
 * address), notes, submit, then a clean confirmation panel with
 * calendar-invite buttons (iCal / Google / Outlook). Reuses all
 * legacy persistence + notification triggers so dealer alerts
 * fire identically.
 */

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  show_in_scheduling: boolean;
  show_in_inspection: boolean;
}

const parseHour = (str: string): number => {
  const m = str.trim().match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (!m) return 9;
  let h = parseInt(m[1], 10);
  const period = m[2].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h;
};

const generateSlots = (openHour: number, closeHour: number): string[] => {
  const slots: string[] = [];
  for (let h = openHour; h < closeHour; h++) {
    for (const min of [0, 30]) {
      const display = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? "AM" : "PM";
      slots.push(`${display}:${min === 0 ? "00" : "30"} ${ampm}`);
    }
  }
  return slots;
};

const DAY_LABELS: Record<number, string[]> = {
  0: ["Sun", "Sunday"],
  1: ["Mon", "Monday", "Mon–Thu", "Mon-Thu", "Mon–Fri", "Mon-Fri"],
  2: ["Tue", "Tuesday", "Mon–Thu", "Mon-Thu", "Mon–Fri", "Mon-Fri"],
  3: ["Wed", "Wednesday", "Mon–Thu", "Mon-Thu", "Mon–Fri", "Mon-Fri"],
  4: ["Thu", "Thursday", "Mon–Thu", "Mon-Thu", "Mon–Fri", "Mon-Fri"],
  5: ["Fri", "Friday", "Fri–Sat", "Fri-Sat", "Mon–Fri", "Mon-Fri"],
  6: ["Sat", "Saturday", "Fri–Sat", "Fri-Sat"],
};

const getTimeSlotsFromConfig = (
  dateStr: string,
  hours: { days: string; hours: string }[],
): string[] => {
  if (!dateStr || !hours?.length) return generateSlots(9, 19);
  const date = new Date(dateStr + "T12:00:00");
  const dow = date.getDay();
  const labels = DAY_LABELS[dow] || [];
  for (const entry of hours) {
    if (labels.some((l) => entry.days.includes(l))) {
      if (/closed/i.test(entry.hours)) return [];
      const parts = entry.hours.split(/\s*[–-]\s*/);
      if (parts.length === 2) {
        return generateSlots(parseHour(parts[0]), parseHour(parts[1]));
      }
    }
  }
  return generateSlots(9, 19);
};

const isSunday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr + "T12:00:00").getDay() === 0;
};

/** Parse a 12h slot like "2:30 PM" into a real Date paired with a
 *  date string. Returns null on bad input. */
function parseAppointmentDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const m = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) {
    // Already 24h?
    const d = new Date(`${dateStr}T${timeStr}`);
    return isNaN(d.getTime()) ? null : d;
  }
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const d = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`);
  return isNaN(d.getTime()) ? null : d;
}

const ScheduleVisitClarity = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const submissionToken = searchParams.get("token") || "";

  const [locations, setLocations] = useState<DealerLocation[]>([]);
  const [lockedStoreId, setLockedStoreId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: searchParams.get("name") || "",
    customer_email: searchParams.get("email") || "",
    customer_phone: searchParams.get("phone") || "",
    preferred_date: "",
    preferred_time: "",
    store_location: searchParams.get("location") || "",
    vehicle_info: searchParams.get("vehicle") || "",
    notes: "",
    inspection_mode: "in_store" as "in_store" | "mobile",
    inspection_address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const offersMobileInspection = (config as any).offers_mobile_inspection === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address, show_in_scheduling, show_in_inspection, temporarily_offline")
        .eq("is_active", true)
        .eq("temporarily_offline", false)
        .order("sort_order");
      if (cancelled || !data) return;
      const filtered = (data as any[]).filter((l) => l.show_in_scheduling || l.show_in_inspection);
      setLocations(filtered as unknown as DealerLocation[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!submissionToken) return;
    supabase
      .from("submissions")
      .select("store_location_id")
      .eq("token", submissionToken)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.store_location_id) setLockedStoreId(data.store_location_id);
      });
  }, [submissionToken]);

  useEffect(() => {
    if (lockedStoreId) {
      setForm((prev) => ({ ...prev, store_location: lockedStoreId }));
    } else if (locations.length === 1 && !form.store_location) {
      setForm((prev) => ({ ...prev, store_location: locations[0].id }));
    }
  }, [locations, lockedStoreId, form.store_location]);

  const availableSlots = getTimeSlotsFromConfig(form.preferred_date, config.business_hours || []);
  const selectedDateIsSunday = isSunday(form.preferred_date);
  const today = new Date().toISOString().split("T")[0];

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "preferred_date") {
        const slots = getTimeSlotsFromConfig(value, config.business_hours || []);
        if (!slots.includes(prev.preferred_time)) next.preferred_time = "";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.preferred_time && !selectedDateIsSunday) {
      toast({ title: "Please select a preferred time", variant: "destructive" });
      return;
    }
    if (form.inspection_mode === "in_store" && !form.store_location && locations.length > 1) {
      toast({ title: "Please select a store location", variant: "destructive" });
      return;
    }
    if (form.inspection_mode === "mobile" && !form.inspection_address.trim()) {
      toast({ title: "Please enter the address where the inspector should meet you", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        store_location: form.inspection_mode === "in_store" ? (form.store_location || null) : null,
        vehicle_info: form.vehicle_info || null,
        notes: form.notes || null,
        submission_token: submissionToken || null,
        inspection_mode: form.inspection_mode,
        inspection_address: form.inspection_mode === "mobile" ? form.inspection_address.trim() : null,
      } as any);
      if (error) throw error;

      if (submissionToken) {
        supabase
          .from("submissions")
          .update({ appointment_date: form.preferred_date, appointment_set: true })
          .eq("token", submissionToken)
          .then();
      }

      // Dealer + customer notifications. Same triggers as the legacy
      // page so BDC alerts fire identically regardless of template.
      supabase.functions.invoke("notify-appointment", { body: { appointment: form } });
      if (submissionToken) {
        const { data: sub } = await supabase
          .from("submissions")
          .select("id")
          .eq("token", submissionToken)
          .maybeSingle();
        if (sub) {
          const apptCtx = { from: "ScheduleVisitClarity.submit", submission_id: sub.id } as const;
          safeInvoke("send-notification", {
            body: {
              trigger_key: "appointment_booked",
              submission_id: sub.id,
              appointment_date: form.preferred_date,
              appointment_time: form.preferred_time,
              location: form.store_location || "",
            },
            context: apptCtx,
          });
          safeInvoke("send-notification", {
            body: {
              trigger_key: "customer_appointment_booked",
              submission_id: sub.id,
              appointment_date: form.preferred_date,
              appointment_time: form.preferred_time,
              location: form.store_location || "",
            },
            context: apptCtx,
          });
        }
      }

      logConsent({
        customerName: form.customer_name,
        customerPhone: form.customer_phone,
        customerEmail: form.customer_email,
        formSource: "schedule_visit",
      });
      track("appointment_booked", { location: form.store_location || undefined });
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message || "Failed to schedule appointment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLocation = locations.find((l) => l.id === form.store_location);
  const locationName = selectedLocation?.name || "";
  const locationAddress = selectedLocation
    ? [selectedLocation.address, selectedLocation.city, selectedLocation.state].filter(Boolean).join(", ")
    : "";

  const calParams = (() => {
    if (!form.preferred_date || !form.preferred_time) return null;
    const start = parseAppointmentDate(form.preferred_date, form.preferred_time);
    if (!start) return null;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      title: `Vehicle Inspection — ${form.vehicle_info || "your vehicle"}`,
      description: "Bring your title, ID, and keys.",
      location: form.inspection_mode === "in_store" ? locationAddress : form.inspection_address,
      startDate: start,
      endDate: end,
    };
  })();
  const icsString = calParams
    ? generateICalEvent({
        summary: calParams.title,
        description: calParams.description,
        location: calParams.location,
        startDate: calParams.startDate,
        endDate: calParams.endDate,
        organizerName: config.dealership_name || "Dealer",
        organizerEmail: config.email || "noreply@dealer.local",
      })
    : null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <Header config={config} />
        <main className="max-w-[640px] mx-auto px-5 md:px-8 py-12 md:py-16 space-y-10">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="text-center space-y-5"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50"
              aria-hidden="true"
            >
              <CheckCircle className="w-8 h-8 text-emerald-500" strokeWidth={2} />
            </motion.div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Confirmed</p>
            <h1 className="font-sans text-[36px] md:text-[48px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
              You're booked.
            </h1>
            <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
              {form.customer_name && `${form.customer_name.split(" ")[0]}, `}
              we'll see you{" "}
              <span className="font-bold text-zinc-900">
                {new Date(`${form.preferred_date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at {form.preferred_time}
              </span>
              {form.inspection_mode === "in_store" && locationName ? ` at ${locationName}.` : "."}
            </p>
          </motion.section>

          {calParams && icsString && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCalendarInvite(icsString, `appointment-${submissionToken || "visit"}.ics`)}
                className="rounded-full text-xs font-semibold border-zinc-200 text-zinc-900 hover:bg-zinc-50"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> iCal
              </Button>
              <a
                href={generateGoogleCalendarUrl(calParams)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-900 hover:bg-zinc-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Google
              </a>
              <a
                href={generateOutlookCalendarUrl(calParams)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold border border-zinc-200 text-zinc-900 hover:bg-zinc-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Outlook
              </a>
            </div>
          )}

          {submissionToken && (
            <div className="text-center pt-2">
              <Button
                onClick={() => navigate(`/my-submission/${submissionToken}`)}
                className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
              >
                View my submission
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Header config={config} />
      <main className="max-w-[640px] mx-auto px-5 md:px-8 py-10 md:py-14">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3 text-center mb-10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Schedule</p>
          <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
            Book your inspection
          </h1>
          {form.vehicle_info && (
            <p className="text-sm text-zinc-500">For your {form.vehicle_info}</p>
          )}
        </motion.section>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mobile / in-store toggle */}
          {offersMobileInspection && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-zinc-100">
              <button
                type="button"
                onClick={() => handleChange("inspection_mode", "in_store")}
                className={`h-10 rounded-full text-sm font-semibold transition-colors ${
                  form.inspection_mode === "in_store" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                Visit dealership
              </button>
              <button
                type="button"
                onClick={() => handleChange("inspection_mode", "mobile")}
                className={`h-10 rounded-full text-sm font-semibold transition-colors ${
                  form.inspection_mode === "mobile" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                Mobile inspection
              </button>
            </div>
          )}

          <FieldGroup label="Your details">
            <Field id="cust-name" label="Full name" value={form.customer_name} onChange={(v) => handleChange("customer_name", v)} autoComplete="name" required />
            <Field id="cust-phone" label="Cell phone" type="tel" value={form.customer_phone} onChange={(v) => handleChange("customer_phone", v)} autoComplete="tel" required />
            <Field id="cust-email" label="Email" type="email" value={form.customer_email} onChange={(v) => handleChange("customer_email", v)} autoComplete="email" required />
          </FieldGroup>

          <FieldGroup label="Date & time">
            <Field id="pref-date" label="Preferred date" type="date" value={form.preferred_date} onChange={(v) => handleChange("preferred_date", v)} min={today} required />
            {selectedDateIsSunday ? (
              <p className="text-xs text-zinc-500">We're closed on Sundays. Please pick another day.</p>
            ) : availableSlots.length === 0 ? (
              <p className="text-xs text-zinc-500">No available times for that date.</p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="pref-time" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Preferred time
                </Label>
                <select
                  id="pref-time"
                  value={form.preferred_time}
                  onChange={(e) => handleChange("preferred_time", e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-white focus:border-zinc-900 focus:outline-none text-sm text-zinc-900"
                >
                  <option value="">Select a time</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </FieldGroup>

          {form.inspection_mode === "in_store" && locations.length > 0 && (
            <FieldGroup label="Location">
              {locations.length === 1 || lockedStoreId ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 px-4 py-3 flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-zinc-500" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-900">
                      {(locations.find((l) => l.id === form.store_location) || locations[0]).name}
                    </p>
                    {(locations.find((l) => l.id === form.store_location) || locations[0]).address && (
                      <p className="text-xs text-zinc-500">
                        {(locations.find((l) => l.id === form.store_location) || locations[0]).address}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="store-loc" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Store
                  </Label>
                  <select
                    id="store-loc"
                    value={form.store_location}
                    onChange={(e) => handleChange("store_location", e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-white focus:border-zinc-900 focus:outline-none text-sm text-zinc-900"
                  >
                    <option value="">Select a store</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} — {loc.city}, {loc.state}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </FieldGroup>
          )}

          {form.inspection_mode === "mobile" && (
            <FieldGroup label="Where should we meet you?">
              <Field
                id="insp-addr"
                label="Address"
                value={form.inspection_address}
                onChange={(v) => handleChange("inspection_address", v)}
                placeholder="123 Main St, Anytown, CT"
                required
              />
            </FieldGroup>
          )}

          <FieldGroup label="Notes (optional)">
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Anything we should know — gate code, second key, etc."
              rows={3}
              className="rounded-xl border-zinc-200 focus:border-zinc-900"
            />
          </FieldGroup>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-14 rounded-full text-base font-semibold bg-zinc-900 hover:bg-zinc-800 text-white"
            style={
              config.landing_cta_color
                ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                : undefined
            }
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Booking…
              </>
            ) : (
              <>
                Book my inspection
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-[11px] text-zinc-400 leading-relaxed pt-6">
          Bring your title, photo ID, and all keys to the inspection.
        </p>
      </main>
    </div>
  );
};

const Header = ({ config }: { config: any }) => (
  <header className="border-b border-zinc-200 bg-white">
    <div className="max-w-[840px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 min-w-0">
        <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
        {config.logo_url ? (
          <img src={config.logo_url} alt={config.dealership_name} className="h-7 w-auto object-contain" />
        ) : (
          <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">
            {config.dealership_name}
          </span>
        )}
      </Link>
      {config.phone && (
        <a
          href={`tel:${config.phone}`}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          {config.phone}
        </a>
      )}
    </div>
  </header>
);

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <fieldset className="space-y-3">
    <legend className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
      {label}
    </legend>
    <div className="space-y-3">{children}</div>
  </fieldset>
);

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
}

const Field = ({ id, label, value, onChange, type = "text", autoComplete, required, placeholder, min }: FieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {label}
    </Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      required={required}
      placeholder={placeholder}
      min={min}
      className="h-12 rounded-xl border-zinc-200 focus:border-zinc-900"
    />
  </div>
);

export default ScheduleVisitClarity;

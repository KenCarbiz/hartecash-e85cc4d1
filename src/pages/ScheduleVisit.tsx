import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logConsent } from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { CalendarDays, CheckCircle2, Loader2, ArrowLeft, MapPin, Car, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import harteLogo from "@/assets/harte-logo-white.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  show_in_scheduling: boolean;
}

/**
 * Parses "9 AM" or "7 PM" → 9 or 19 (24h).
 * Handles formats like "9 AM", "12 PM", "6 PM".
 */
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

/** Maps day-of-week index (0=Sun…6=Sat) to a label used in business_hours config */
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
  hours: { days: string; hours: string }[]
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
  const date = new Date(dateStr + "T12:00:00");
  return date.getDay() === 0;
};

const ScheduleVisit = () => {
  const [searchParams] = useSearchParams();
  const submissionToken = searchParams.get("token") || "";
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const [locations, setLocations] = useState<DealerLocation[]>([]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address, show_in_scheduling, temporarily_offline")
        .eq("is_active", true)
        .eq("show_in_scheduling", true)
        .eq("temporarily_offline", false)
        .order("sort_order");
      if (data) setLocations(data as unknown as DealerLocation[]);
    };
    fetchLocations();
  }, []);

  const [form, setForm] = useState({
    customer_name: searchParams.get("name") || "",
    customer_email: searchParams.get("email") || "",
    customer_phone: searchParams.get("phone") || "",
    preferred_date: "",
    preferred_time: "",
    store_location: searchParams.get("location") || "",
    vehicle_info: searchParams.get("vehicle") || "",
    notes: "",
  });

  // Auto-select if only one scheduling location
  useEffect(() => {
    if (locations.length === 1 && !form.store_location) {
      setForm(prev => ({ ...prev, store_location: locations[0].id }));
    }
  }, [locations]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset time if date changes and current time is no longer valid
      if (field === "preferred_date") {
        const slots = getTimeSlotsFromConfig(value, config.business_hours || []);
        if (!slots.includes(prev.preferred_time)) {
          next.preferred_time = "";
        }
      }
      return next;
    });
  };

  const availableSlots = getTimeSlotsFromConfig(form.preferred_date, config.business_hours || []);
  const selectedDateIsSunday = isSunday(form.preferred_date);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate select fields that can't use native required
    if (!form.preferred_time && !selectedDateIsSunday) {
      toast({ title: "Please select a preferred time", variant: "destructive" });
      return;
    }
    if (!form.store_location && locations.length > 1) {
      toast({ title: "Please select a store location", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // Insert appointment
      const { error } = await supabase.from("appointments").insert({
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        store_location: form.store_location || null,
        vehicle_info: form.vehicle_info || null,
        notes: form.notes || null,
        submission_token: submissionToken || null,
      } as any);

      if (error) throw error;

      // If linked to a submission, mark appointment set
      if (submissionToken) {
        supabase
          .from("submissions")
          .update({
            appointment_date: form.preferred_date,
            appointment_set: true,
          })
          .eq("token", submissionToken)
          .then();
      }

      // Send notification (fire-and-forget)
      supabase.functions.invoke("notify-appointment", {
        body: { appointment: form },
      });

      // Fire appointment_booked staff notification
      if (submissionToken) {
        const { data: sub } = await supabase
          .from("submissions")
          .select("id")
          .eq("token", submissionToken)
          .maybeSingle();
        if (sub) {
          supabase.functions.invoke("send-notification", {
            body: {
              trigger_key: "appointment_booked",
              submission_id: sub.id,
              appointment_date: form.preferred_date,
              appointment_time: form.preferred_time,
              location: form.store_location || "",
            },
          }).catch(console.error);
        }
      }

      // Log TCPA consent
      logConsent({
        customerName: form.customer_name,
        customerPhone: form.customer_phone,
        customerEmail: form.customer_email,
        formSource: "schedule_visit",
      });

      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to schedule appointment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return dateStr;
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const locationName = locations.find(l => l.id === form.store_location)?.name || form.store_location;

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="bg-primary text-primary-foreground px-6 py-4">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            {submissionToken && (
              <Link to={`/my-submission/${submissionToken}`} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <img src={config.logo_white_url || harteLogo} alt={config.dealership_name} className="h-[70px] w-auto" />
            <h1 className="font-bold text-lg">Schedule a Visit</h1>
          </div>
        </div>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full shadow-sm border-border">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h2 className="font-display text-3xl text-foreground tracking-wide">Appointment Requested</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our team will reach out shortly to confirm your visit.
                </p>
              </div>

              <div className="bg-muted/30 border border-border rounded-xl divide-y divide-border overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="h-4.5 w-4.5 text-primary/70" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date & Time</p>
                    <p className="font-semibold text-foreground">{formatDate(form.preferred_date)}</p>
                    <p className="text-sm text-foreground">{form.preferred_time}</p>
                  </div>
                </div>
                {locationName && (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4.5 w-4.5 text-primary/70" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-semibold text-foreground">{locationName}</p>
                    </div>
                  </div>
                )}
                {form.vehicle_info && (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Car className="h-4.5 w-4.5 text-primary/70" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle</p>
                      <p className="font-semibold text-foreground">{form.vehicle_info}</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-success" />
                A confirmation will be sent to <strong>{form.customer_email}</strong>
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Schedule Your Visit | Harte Auto Group"
        description="Book an appointment to sell or trade in your vehicle at Harte Auto Group. Pick a time and location that works for you."
        path="/schedule"
      />
      <div className="bg-primary text-primary-foreground px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to={submissionToken ? `/my-submission/${submissionToken}` : "/"} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={config.logo_white_url || harteLogo} alt={config.dealership_name} className="h-[70px] w-auto" />
          <h1 className="font-bold text-lg">Schedule a Visit</h1>
        </div>
      </div>
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <Card className="max-w-lg w-full shadow-sm border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/5">
              <CalendarDays className="h-7 w-7 text-primary/70" />
            </div>
            <CardTitle className="font-display text-2xl tracking-wide">Schedule a Visit</CardTitle>
            <CardDescription className="leading-relaxed">
              Pick a preferred date and time, and we'll confirm your appointment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Full Name *</Label>
                  <Input
                    id="customer_name"
                    required
                    value={form.customer_name}
                    onChange={(e) => handleChange("customer_name", e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone *</Label>
                  <Input
                    id="customer_phone"
                    required
                    type="tel"
                    value={form.customer_phone}
                    onChange={(e) => handleChange("customer_phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email *</Label>
                <Input
                  id="customer_email"
                  required
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => handleChange("customer_email", e.target.value)}
                  placeholder="john@example.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferred_date">Preferred Date *</Label>
                  <Input
                    id="preferred_date"
                    required
                    type="date"
                    min={today}
                    value={form.preferred_date}
                    onChange={(e) => handleChange("preferred_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferred_time">Preferred Time *</Label>
                  {selectedDateIsSunday ? (
                    <p className="text-sm text-destructive font-medium py-2">
                      We are closed on Sundays. Please select another date.
                    </p>
                  ) : (
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={form.preferred_time}
                      onChange={(e) => handleChange("preferred_time", e.target.value)}
                      disabled={!form.preferred_date}
                    >
                      <option value="">{form.preferred_date ? "Select a time" : "Pick a date first"}</option>
                      {availableSlots.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                  {form.preferred_date && !selectedDateIsSunday && (
                    <p className="text-xs text-muted-foreground">
                      {[5, 6].includes(new Date(form.preferred_date + "T12:00:00").getDay())
                        ? "Fri–Sat: 9:00 AM – 6:00 PM"
                        : "Mon–Thu: 9:00 AM – 7:00 PM"}
                    </p>
                  )}
                </div>
              </div>

              {locations.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="store_location">Preferred Location *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.store_location}
                    onChange={(e) => handleChange("store_location", e.target.value)}
                  >
                    <option value="">Select a store location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} — {loc.city}, {loc.state}
                        {loc.address ? ` (${loc.address})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="vehicle_info">Vehicle Info (optional)</Label>
                <Input
                  id="vehicle_info"
                  value={form.vehicle_info}
                  onChange={(e) => handleChange("vehicle_info", e.target.value)}
                  placeholder="e.g. 2020 Toyota Camry"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Anything else you'd like us to know?"
                  rows={3}
                />
              </div>

              <div className="p-3.5 bg-muted/30 border border-border rounded-xl">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By submitting, you consent to receive autodialed calls, texts (SMS/MMS), and emails from {config.dealership_name || "Harte Auto Group"} at the number and email provided regarding your appointment and vehicle. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out. See our{" "}
                  <a href="/privacy#sms-consent" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Terms of Service</a>.
                </p>
              </div>

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-lg shadow-accent/20 rounded-xl" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  "Request Appointment"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ScheduleVisit;

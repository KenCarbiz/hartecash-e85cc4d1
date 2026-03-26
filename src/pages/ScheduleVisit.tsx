import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logConsent } from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { CalendarDays, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import harteLogo from "@/assets/harte-logo-white.png";
import SEO from "@/components/SEO";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  show_in_scheduling: boolean;
}

// Store hours: Mon-Thu 9AM-7PM, Fri-Sat 9AM-6PM, Sun Closed
const WEEKDAY_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM",
];

const FRIDAY_SAT_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM",
];

const getTimeSlotsForDate = (dateStr: string): string[] => {
  if (!dateStr) return WEEKDAY_SLOTS;
  const date = new Date(dateStr + "T12:00:00");
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  if (day === 0) return []; // Sunday closed
  if (day === 5 || day === 6) return FRIDAY_SAT_SLOTS; // Fri-Sat 9-6
  return WEEKDAY_SLOTS; // Mon-Thu 9-7
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
  const [locations, setLocations] = useState<DealerLocation[]>([]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address, show_in_scheduling")
        .eq("is_active", true)
        .eq("show_in_scheduling", true)
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
        const slots = getTimeSlotsForDate(value);
        if (!slots.includes(prev.preferred_time)) {
          next.preferred_time = "";
        }
      }
      return next;
    });
  };

  const availableSlots = getTimeSlotsForDate(form.preferred_date);
  const selectedDateIsSunday = isSunday(form.preferred_date);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate select fields that can't use native required
    if (!form.preferred_time && !selectedDateIsSunday) {
      toast({ title: "Please select a preferred time", variant: "destructive" });
      return;
    }
    if (!form.store_location) {
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
            <img src={harteLogo} alt="Harte" className="h-[60px] w-auto" />
            <h1 className="font-bold text-lg">Schedule a Visit</h1>
          </div>
        </div>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Appointment Requested</h2>
                <p className="text-sm text-muted-foreground">
                  Our team will reach out shortly to confirm your visit.
                </p>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg divide-y divide-border">
                <div className="flex items-center gap-3 px-4 py-3">
                  <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date & Time</p>
                    <p className="font-semibold text-foreground">{formatDate(form.preferred_date)}</p>
                    <p className="text-sm text-foreground">{form.preferred_time}</p>
                  </div>
                </div>
                {locationName && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-semibold text-foreground">{locationName}</p>
                    </div>
                  </div>
                )}
                {form.vehicle_info && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                    <div>
                      <p className="text-xs text-muted-foreground">Vehicle</p>
                      <p className="font-semibold text-foreground">{form.vehicle_info}</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-muted-foreground">
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
          {submissionToken && (
            <Link to={`/my-submission/${submissionToken}`} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <img src={harteLogo} alt="Harte" className="h-[60px] w-auto" />
          <h1 className="font-bold text-lg">Schedule a Visit</h1>
        </div>
      </div>
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Schedule a Visit</CardTitle>
            <CardDescription>
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

              <div className="p-3 bg-muted/50 border border-border rounded-lg">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By submitting, you consent to receive autodialed calls, texts (SMS/MMS), and emails from Harte Auto Group at the number and email provided regarding your appointment and vehicle. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out. See our{" "}
                  <a href="/privacy#sms-consent" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Terms of Service</a>.
                </p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
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

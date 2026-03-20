import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logConsent } from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import harteLogo from "@/assets/harte-logo-white.png";

// Harte Auto Group store locations
const STORE_LOCATIONS = [
  { value: "hartford_nissan", label: "Harte Nissan — Hartford, CT" },
  { value: "hartford_infiniti", label: "Harte Infiniti — Hartford, CT" },
  { value: "west_haven", label: "George Harte Nissan — West Haven, CT" },
  { value: "wallingford", label: "George Harte Infiniti — Wallingford, CT" },
  { value: "old_saybrook", label: "Harte Hyundai — Old Saybrook, CT" },
];

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
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
              <h2 className="text-2xl font-bold text-foreground">Request Received!</h2>
              <p className="text-muted-foreground">
                We've received your appointment request for{" "}
                <strong>{form.preferred_date}</strong> at{" "}
                <strong>{form.preferred_time}</strong>
                {form.store_location && (
                  <> at <strong>{STORE_LOCATIONS.find(l => l.value === form.store_location)?.label || form.store_location}</strong></>
                )}
                . Our team will reach out shortly to confirm.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
                    <Select
                      value={form.preferred_time}
                      onValueChange={(v) => handleChange("preferred_time", v)}
                      required
                      disabled={!form.preferred_date}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={form.preferred_date ? "Select a time" : "Pick a date first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSlots.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

              <div className="space-y-2">
                <Label htmlFor="store_location">Preferred Location *</Label>
                <Select
                  value={form.store_location}
                  onValueChange={(v) => handleChange("store_location", v)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a store location" />
                  </SelectTrigger>
                  <SelectContent>
                    {STORE_LOCATIONS.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

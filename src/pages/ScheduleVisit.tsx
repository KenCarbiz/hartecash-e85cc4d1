import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM",
];

const ScheduleVisit = () => {
  const [searchParams] = useSearchParams();
  const submissionToken = searchParams.get("token") || "";
  const { toast } = useToast();

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    preferred_date: "",
    preferred_time: "",
    vehicle_info: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
        vehicle_info: form.vehicle_info || null,
        notes: form.notes || null,
        submission_token: submissionToken || null,
      });

      if (error) throw error;

      // Send notification (fire-and-forget)
      supabase.functions.invoke("notify-appointment", {
        body: { appointment: form },
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
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
              <h2 className="text-2xl font-bold text-foreground">Request Received!</h2>
              <p className="text-muted-foreground">
                We've received your appointment request for{" "}
                <strong>{form.preferred_date}</strong> at{" "}
                <strong>{form.preferred_time}</strong>. Our team will reach out
                shortly to confirm.
              </p>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
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
                  <Select
                    value={form.preferred_time}
                    onValueChange={(v) => handleChange("preferred_time", v)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
      <SiteFooter />
    </div>
  );
};

export default ScheduleVisit;

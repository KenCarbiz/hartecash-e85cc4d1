import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateICalEvent,
  downloadCalendarInvite,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
} from "@/lib/calendarInvite";

interface AppointmentRow {
  preferred_date: string;
  preferred_time: string;
  store_location: string | null;
  location_name: string | null;
  location_address: string | null;
  location_city: string | null;
  location_state: string | null;
}

interface Props {
  token: string;
  vehicleStr?: string;
  organizerName?: string;
  organizerEmail?: string;
}

/**
 * Reusable card for the customer-facing portal/post-acceptance pages
 * showing the booked appointment with one-click calendar adds (Google,
 * Outlook, .ics) and a "Get directions" button.
 *
 * Self-fetches by submission token so callers just pass the token —
 * keeps the logic in one place. Renders nothing if there's no
 * appointment yet, so it's safe to drop in on any portal page.
 */
export default function AppointmentCalendarCard({
  token,
  vehicleStr = "",
  organizerName = "Dealership",
  organizerEmail = "noreply@autocurb.io",
}: Props) {
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("appointments")
        .select("preferred_date, preferred_time, store_location")
        .eq("submission_token", token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      let locName: string | null = null;
      let locAddress: string | null = null;
      let locCity: string | null = null;
      let locState: string | null = null;
      if (data.store_location) {
        const { data: loc } = await (supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { name: string; address: string | null; city: string | null; state: string | null } | null }> };
            };
          };
        })
          .from("dealership_locations")
          .select("name, address, city, state")
          .eq("id", data.store_location)
          .maybeSingle();
        if (loc) {
          locName = loc.name;
          locAddress = loc.address;
          locCity = loc.city;
          locState = loc.state;
        }
      }
      setAppointment({
        preferred_date: data.preferred_date,
        preferred_time: data.preferred_time,
        store_location: data.store_location,
        location_name: locName,
        location_address: locAddress,
        location_city: locCity,
        location_state: locState,
      });
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!appointment) return null;

  const { preferred_date, preferred_time, location_name, location_address, location_city, location_state } = appointment;

  // Parse "10:00 AM" / "2:30 PM" into 24-hr.
  const parseTime = (s: string): { h: number; m: number } | null => {
    const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return { h, m: min };
  };

  const buildStartDate = (): Date | null => {
    const t = parseTime(preferred_time);
    if (!t) return null;
    const d = new Date(`${preferred_date}T00:00:00`);
    d.setHours(t.h, t.m, 0, 0);
    return d;
  };

  const start = buildStartDate();
  const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
  const locationFull = [location_address, location_city, location_state].filter(Boolean).join(", ");

  const calendarParams = start && end
    ? {
        title: vehicleStr ? `Vehicle Inspection - ${vehicleStr}` : "Vehicle Inspection",
        description: `Vehicle inspection appointment${location_name ? ` at ${location_name}` : ""}. Please bring your Driver's License, Vehicle Title/Registration, and all keys & remotes. Expected duration: 15-20 minutes.`,
        location: locationFull,
        startDate: start,
        endDate: end,
      }
    : null;

  const handleDownloadIcs = () => {
    if (!calendarParams) return;
    const ics = generateICalEvent({ ...calendarParams, summary: calendarParams.title, organizerName, organizerEmail });
    downloadCalendarInvite(ics, "vehicle-inspection-appointment.ics");
  };

  const directionsUrl = locationFull
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationFull)}`
    : null;

  const fmtDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="bg-card rounded-xl p-5 shadow-lg border border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="h-4 w-4 text-primary/70" />
        </div>
        <div>
          <p className="font-semibold text-card-foreground">Your Inspection Appointment</p>
          <p className="text-sm text-muted-foreground">
            {fmtDate(preferred_date)} at {preferred_time}
            {location_name ? ` — ${location_name}` : ""}
          </p>
        </div>
      </div>

      <div className="border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Add to Calendar
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleDownloadIcs} disabled={!calendarParams}>
            <Download className="w-4 h-4" />
            Download .ics
          </Button>
          {calendarParams && (
            <>
              <Button variant="outline" size="sm" className="flex-1 gap-2" asChild>
                <a href={generateGoogleCalendarUrl(calendarParams)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Google
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-2" asChild>
                <a href={generateOutlookCalendarUrl(calendarParams)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  Outlook
                </a>
              </Button>
            </>
          )}
        </div>
        {directionsUrl && (
          <div className="pt-2 border-t border-border/40">
            <Button variant="outline" size="sm" className="w-full gap-2" asChild>
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Get directions to {location_name || "the dealership"}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

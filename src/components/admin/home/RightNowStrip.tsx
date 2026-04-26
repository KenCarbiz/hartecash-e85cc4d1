// "RIGHT NOW" strip on the Today home page — surfaces customers who
// are physically arriving (or about to). See
// frontend-redesign/CLAUDE_CODE_BRIEF.md §2.
//
// Filter rules (per brief):
//   - progress_status === "arrived"      → red "arrival" card
//   - progress_status === "on_the_way"   → warn "on the way" card
//   - any submission with an appointment in the next 60 min and
//     portal_view_count >= 1 (customer is engaged) → on-the-way card
//
// All buttons open the detail sheet via `onView(sub)` for now. The
// activity-log entries that the buttons should fire on click land
// alongside the customer self check-in work in Step 7.

import type { Submission, Appointment } from "@/lib/adminConstants";
import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, Clock } from "lucide-react";

interface RightNowStripProps {
  submissions: Submission[];
  appointments: Appointment[];
  onView: (sub: Submission) => void;
}

const ARRIVED_STATUS = "arrived";
const ON_THE_WAY_STATUS = "on_the_way";
const SOON_WINDOW_MS = 60 * 60 * 1000; // appointments within next 60 min

// Combine an appointment's separate date + time string fields into a
// single Date. Returns null on parse failure (the source columns are
// loosely-typed strings, so we tolerate junk).
const parseApptDate = (appt: Appointment): Date | null => {
  if (!appt.preferred_date || !appt.preferred_time) return null;
  const combined = `${appt.preferred_date} ${appt.preferred_time}`;
  const t = new Date(combined).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t);
};

const vehicleLine = (s: Submission) => {
  const yr = s.vehicle_year || "";
  const mk = s.vehicle_make || "";
  const md = s.vehicle_model || "";
  const head = [yr, mk, md].filter(Boolean).join(" ").trim();
  const miNum = s.mileage ? Number(s.mileage.replace(/[^\d]/g, "")) : NaN;
  const mi = Number.isFinite(miNum) && miNum > 0
    ? ` · ${miNum.toLocaleString()} mi`
    : "";
  return head + mi;
};

const telLink = (phone: string | null | undefined) => {
  const digits = phone?.replace(/\D/g, "");
  return digits ? `tel:+1${digits}` : undefined;
};

// Compact "time since" formatter for arrival/on-the-way card timestamps.
// Pulls from on_the_way_at / arrived_at when present, else falls back to
// status_updated_at, else hides. Output: "2m ago" / "12m ago" / "1h ago".
const fmtAgo = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
};

const offerOrApptText = (s: Submission, apptAt?: Date): string | null => {
  if (s.offered_price && s.offered_price > 0) {
    return `$${s.offered_price.toLocaleString()}`;
  }
  if (apptAt) {
    return `Appt ${apptAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (s.estimated_offer_high && s.estimated_offer_high > 0) {
    return `~$${s.estimated_offer_high.toLocaleString()}`;
  }
  return null;
};

const RightNowStrip = ({ submissions, appointments, onView }: RightNowStripProps) => {
  const now = Date.now();

  // Build the soon-appointment lookup once: submission_token → appt.
  // Walk-in (token-less) appointments are excluded — they can't be
  // joined to the submission stream that drives this strip.
  const apptByToken = new Map<string, { appt: Appointment; when: Date }>();
  for (const appt of appointments) {
    if (!appt.submission_token) continue;
    const when = parseApptDate(appt);
    if (!when) continue;
    const delta = when.getTime() - now;
    if (delta > 0 && delta < SOON_WINDOW_MS) {
      apptByToken.set(appt.submission_token, { appt, when });
    }
  }

  type Card = { sub: Submission; kind: "arrived" | "on_the_way"; apptAt?: Date };
  const cards: Card[] = [];

  for (const s of submissions) {
    const apptHit = apptByToken.get(s.token);
    if (s.progress_status === ARRIVED_STATUS) {
      cards.push({ sub: s, kind: "arrived", apptAt: apptHit?.when });
      continue;
    }
    if (s.progress_status === ON_THE_WAY_STATUS) {
      cards.push({ sub: s, kind: "on_the_way", apptAt: apptHit?.when });
      continue;
    }
    // Engaged + appointment imminent → treat as on-the-way for the strip.
    // portal_view_count isn't on the typed Submission interface yet, so we
    // read it loosely; the brief calls it out in §2.
    const portalViews = (s as any).portal_view_count ?? 0;
    if (portalViews >= 1 && apptHit) {
      cards.push({ sub: s, kind: "on_the_way", apptAt: apptHit.when });
    }
  }

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="right-now-heading" className="space-y-3">
      <h2
        id="right-now-heading"
        className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      >
        Right now
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map(({ sub, kind, apptAt }) => {
          const isArrival = kind === "arrived";
          const tagText = isArrival ? "JUST ARRIVED" : "ON THE WAY";
          const tagColor = isArrival
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400";
          const dotColor = isArrival
            ? "bg-red-500 animate-pulse"
            : "bg-amber-500";
          const railColor = isArrival ? "border-l-red-500" : "border-l-amber-500";
          // Right-aligned age timestamp pulls from arrived_at / on_the_way_at
          // when populated by the customer-checkin edge function; otherwise
          // falls back to status_updated_at or created_at.
          const agoIso = isArrival
            ? ((sub as any).arrived_at ?? sub.status_updated_at ?? sub.created_at)
            : ((sub as any).on_the_way_at ?? sub.status_updated_at ?? sub.created_at);
          const ago = fmtAgo(agoIso);
          const subtext = offerOrApptText(sub, apptAt);
          const veh = vehicleLine(sub) || "Vehicle details pending";
          const primaryLabel = isArrival ? "Greet now" : "Prep file";
          const tel = telLink(sub.phone);

          return (
            <article
              key={sub.id}
              className={`rounded-xl border border-border bg-card border-l-4 ${railColor} p-4 flex flex-col gap-3 shadow-sm`}
            >
              {/* Header row — colored uppercase tag + dot, age on the right */}
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} aria-hidden />
                <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${tagColor}`}>
                  {tagText}
                </span>
                {ago && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {ago}
                  </span>
                )}
              </div>

              {/* Customer name + vehicle/offer subline */}
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground truncate">
                  {sub.name || "Unknown customer"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {veh}
                  {subtext ? ` · ${subtext}` : ""}
                </p>
              </div>

              {/* Action buttons — full-width primary + secondary */}
              <div className="flex items-center gap-2 mt-auto">
                <Button
                  size="sm"
                  className="h-9 text-[12px] font-semibold flex-1 gap-1"
                  variant={isArrival ? "destructive" : "default"}
                  onClick={() => onView(sub)}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  {primaryLabel}
                </Button>
                {isArrival ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-[12px]"
                    onClick={() => onView(sub)}
                  >
                    Open file
                  </Button>
                ) : tel ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-9 text-[12px] gap-1"
                    aria-label={`Call ${sub.name || "customer"}`}
                  >
                    <a href={tel}>
                      <Phone className="w-3.5 h-3.5" />
                      Call
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-[12px]"
                    onClick={() => onView(sub)}
                  >
                    Open
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RightNowStrip;

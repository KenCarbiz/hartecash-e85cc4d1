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
import { Phone } from "lucide-react";

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

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(({ sub, kind, apptAt }) => {
          const isArrival = kind === "arrived";
          const accentBg = isArrival
            ? "bg-[hsl(4_72%_95%)] dark:bg-[hsl(4_72%_18%)]"
            : "bg-[hsl(32_85%_94%)] dark:bg-[hsl(32_85%_16%)]";
          const accentBorder = isArrival
            ? "border-l-[hsl(4_72%_52%)]"
            : "border-l-[hsl(32_85%_48%)]";
          const dotColor = isArrival
            ? "bg-[hsl(4_72%_52%)] animate-pulse"
            : "bg-[hsl(32_85%_48%)]";
          const tagText = isArrival
            ? "Just arrived on the lot"
            : apptAt
            ? `On the way · Appt ${fmtTime(apptAt)}`
            : "On the way";

          const primaryLabel = isArrival ? "Greet now" : "Prep file";
          const secondary = isArrival ? null : telLink(sub.phone);

          return (
            <article
              key={sub.id}
              className={`rounded-xl border border-border ${accentBg} border-l-4 ${accentBorder} p-4 flex flex-col gap-3`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-1 w-2 h-2 rounded-full ${dotColor}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {sub.name || "Unknown customer"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {vehicleLine(sub) || "Vehicle details pending"}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mt-1">
                    {tagText}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs flex-1"
                  variant={isArrival ? "destructive" : "default"}
                  onClick={() => onView(sub)}
                >
                  {primaryLabel}
                </Button>
                {secondary ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    aria-label={`Call ${sub.name}`}
                  >
                    <a href={secondary}>
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
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

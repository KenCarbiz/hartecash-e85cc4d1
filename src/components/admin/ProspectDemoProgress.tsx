import { useEffect, useState } from "react";
import { Check, Loader2, Brain, Image as ImageIcon, Sparkles, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

/**
 * Stepped progress indicator for the `analyze-prospect-site` edge function.
 *
 * The edge function is a single HTTP call so we can't stream true progress.
 * Instead we simulate phases at realistic durations so the rep sees what's
 * happening and stops wondering whether the spinner is stuck:
 *
 *   1. Authorizing request           (~0.5s)
 *   2. Loading screenshots into AI   (~3s — Claude has to download each img)
 *   3. AI analyzing brand + layout   (~10s — vision reasoning is the slow bit)
 *   4. Generating recommendations    (~3s — tool call assembly)
 *
 * If the real call finishes early, we jump to "done". If it runs long, the
 * last step stays at "in progress" with a live elapsed timer so the rep
 * knows the system isn't frozen.
 */

type StepStatus = "pending" | "active" | "done";

interface Step {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When (ms since start) this step becomes active. */
  startAt: number;
  /** When (ms since start) this step is expected to complete. */
  endAt: number;
}

const STEPS: Step[] = [
  {
    id: "auth",
    label: "Authorizing request",
    hint: "Verifying platform admin access",
    icon: ShieldCheck,
    startAt: 0,
    endAt: 500,
  },
  {
    id: "load",
    label: "Loading screenshots into AI",
    hint: "Fetching homepage, listing, and VDP images",
    icon: ImageIcon,
    startAt: 500,
    endAt: 3500,
  },
  {
    id: "analyze",
    label: "AI analyzing brand & layout",
    hint: "Claude Sonnet inspecting visual hierarchy and accent palette",
    icon: Brain,
    startAt: 3500,
    endAt: 13500,
  },
  {
    id: "recommend",
    label: "Generating recommendations",
    hint: "Composing pitch line, accent color, and per-page placements",
    icon: Sparkles,
    startAt: 13500,
    endAt: 16500,
  },
];

const TOTAL_EXPECTED_MS = STEPS[STEPS.length - 1].endAt;

const formatElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const ProspectDemoAnalyzeProgress = ({ running }: { running: boolean }) => {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (running) {
      setStartedAt(Date.now());
      setNow(Date.now());
      const id = window.setInterval(() => setNow(Date.now()), 250);
      return () => window.clearInterval(id);
    }
    setStartedAt(null);
  }, [running]);

  if (!running || !startedAt) return null;

  const elapsed = now - startedAt;
  const overallPct = Math.min(95, (elapsed / TOTAL_EXPECTED_MS) * 100);

  // Determine the active step. Cap at the last step so we never go past;
  // if we overrun, the final step stays "active" with a live timer.
  const stepStatuses: StepStatus[] = STEPS.map((step, idx) => {
    const isLast = idx === STEPS.length - 1;
    if (elapsed >= step.endAt && !isLast) return "done";
    if (elapsed >= step.startAt) return "active";
    return "pending";
  });
  const overrunning = elapsed > TOTAL_EXPECTED_MS;

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-700 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Analyzing prospect site
        </div>
        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
          {formatElapsed(elapsed)}
          {overrunning && (
            <span className="ml-2 text-amber-600">taking longer than usual…</span>
          )}
        </div>
      </div>

      <Progress value={overallPct} className="h-1.5" />

      <ol className="space-y-2">
        {STEPS.map((step, idx) => {
          const status = stepStatuses[idx];
          const Icon = step.icon;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-3 transition-opacity ${
                status === "pending" ? "opacity-50" : "opacity-100"
              }`}
            >
              <div
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  status === "done"
                    ? "bg-emerald-100 text-emerald-700"
                    : status === "active"
                      ? "bg-violet-100 text-violet-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {status === "done" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : status === "active" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs font-semibold ${
                    status === "active" ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {step.hint}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/**
 * Lightweight stepped progress for the multi-page screenshot capture.
 * Shows a per-page status row so the rep sees which pages have landed
 * and which are still loading instead of one global spinner.
 */
export const ProspectDemoCaptureProgress = ({
  capturing,
  homeUrl,
  listingUrl,
  vdpUrl,
  captures,
  failures,
}: {
  capturing: boolean;
  homeUrl: string;
  listingUrl: string;
  vdpUrl: string;
  captures: { home: string | null; listing: string | null; vdp: string | null };
  failures: { home: string | null; listing: string | null; vdp: string | null };
}) => {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (capturing) {
      setStartedAt(Date.now());
      setNow(Date.now());
      const id = window.setInterval(() => setNow(Date.now()), 250);
      return () => window.clearInterval(id);
    }
    setStartedAt(null);
  }, [capturing]);

  if (!capturing || !startedAt) return null;

  const elapsed = now - startedAt;
  // Microlink typically returns in 8–15s per page; cap progress at 90%.
  const pct = Math.min(90, (elapsed / 15000) * 100);

  const rows: Array<{ key: "home" | "listing" | "vdp"; label: string; url: string }> = [
    { key: "home", label: "Homepage", url: homeUrl },
    { key: "listing", label: "Listing page", url: listingUrl },
    { key: "vdp", label: "Vehicle detail page", url: vdpUrl },
  ];

  return (
    <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-700 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Capturing screenshots
        </div>
        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
          {formatElapsed(elapsed)}
        </div>
      </div>
      <Progress value={pct} className="h-1.5" />
      <ul className="space-y-1.5">
        {rows.map(({ key, label, url }) => {
          const skipped = !url.trim();
          const done = !!captures[key];
          const failed = !!failures[key];
          const status: StepStatus | "skipped" | "failed" = skipped
            ? "skipped"
            : done
              ? "done"
              : failed
                ? "failed"
                : "active";
          return (
            <li key={key} className="flex items-center gap-3 text-xs">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  status === "done"
                    ? "bg-emerald-100 text-emerald-700"
                    : status === "failed"
                      ? "bg-rose-100 text-rose-700"
                      : status === "skipped"
                        ? "bg-slate-100 text-slate-400"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {status === "done" ? (
                  <Check className="w-3 h-3" />
                ) : status === "active" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : status === "skipped" ? (
                  <span className="text-[9px]">—</span>
                ) : (
                  <span className="text-[9px]">!</span>
                )}
              </div>
              <span
                className={`font-semibold ${
                  status === "skipped" ? "text-slate-400" : "text-slate-800"
                }`}
              >
                {label}
              </span>
              <span className="text-[11px] text-slate-500 truncate">
                {skipped
                  ? "(no URL — skipping)"
                  : status === "done"
                    ? "captured"
                    : status === "failed"
                      ? "failed"
                      : "loading…"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Customer self check-in page — /check-in/:token.
// See frontend-redesign/CLAUDE_CODE_BRIEF.md §7.
//
// Mobile-first single-screen flow. Two big buttons:
//   - "I'm on my way"  → POSTs action="on_the_way"
//   - "I'm here"       → POSTs action="arrived"
//
// All writes go through the customer-checkin edge function — the
// customer's browser never holds a Supabase session, only the
// submission token in the URL. The edge function does role-bypass via
// the service-role key + token validation.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";

type Action = "on_the_way" | "arrived";

interface CheckInShape {
  token: string;
  name: string | null;
  vehicle: string | null;
  progress_status: string;
  on_the_way_at: string | null;
  arrived_at: string | null;
}

const callEdge = async (
  body: { token: string; action: "fetch" | Action },
): Promise<{ ok: true; submission: CheckInShape } | { ok: false; error: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke("customer-checkin", {
      body,
    });
    if (error) return { ok: false, error: error.message || "request_failed" };
    if (data && data.ok && data.submission) {
      return { ok: true, submission: data.submission as CheckInShape };
    }
    return { ok: false, error: (data as any)?.error || "request_failed" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "request_failed" };
  }
};

const CustomerCheckIn = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<CheckInShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Action | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrMsg("Missing check-in code.");
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await callEdge({ token, action: "fetch" });
      if (cancelled) return;
      if (result.ok === true) {
        setSubmission(result.submission);
      } else {
        setErrMsg(
          result.error === "not_found"
            ? "We couldn't find your appointment. Double-check the link from your confirmation email."
            : "Something went wrong. Try again in a moment.",
        );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const tap = async (action: Action) => {
    if (!token || pending) return;
    setPending(action);
    setErrMsg(null);
    const result = await callEdge({ token, action });
    if (result.ok === true) {
      setSubmission(result.submission);
    } else if (result.error === "terminal_state") {
      setErrMsg("This visit has already wrapped up — no need to check in.");
    } else {
      setErrMsg("Couldn't reach the dealership. Please try again.");
    }
    setPending(null);
  };

  const status = submission?.progress_status;
  const isArrived = status === "arrived";
  const isOnTheWay = status === "on_the_way";

  const greeting = useMemo(() => {
    const fn = (submission?.name || "").trim().split(/\s+/)[0];
    if (!fn) return "Welcome";
    return `Hi ${fn}`;
  }, [submission?.name]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errMsg && !submission) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-base font-semibold text-foreground">Check-in unavailable</p>
          <p className="text-sm text-muted-foreground">{errMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[hsl(40_30%_98%)] dark:bg-background px-5 py-10 flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* Header */}
        <header className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Self check-in
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">
            {greeting}
          </h1>
          {submission?.vehicle && (
            <p className="text-sm text-muted-foreground mt-2">
              for your <span className="font-semibold text-foreground">{submission.vehicle}</span>
            </p>
          )}
        </header>

        {/* State-specific body */}
        {isArrived ? (
          <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
              We've notified your salesperson.
            </p>
            <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90">
              Head inside — someone will meet you in a moment.
            </p>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {isOnTheWay && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Got it — we're getting ready for you.
                </p>
                <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                  Tap "I'm here" when you arrive on the lot.
                </p>
              </div>
            )}

            <Button
              size="lg"
              variant={isOnTheWay ? "outline" : "default"}
              className="w-full h-14 text-base font-semibold"
              disabled={pending !== null || isOnTheWay}
              onClick={() => tap("on_the_way")}
            >
              {pending === "on_the_way" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <MapPin className="w-5 h-5 mr-2" />
                  {isOnTheWay ? "On the way" : "I'm on my way"}
                </>
              )}
            </Button>

            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold bg-[hsl(4_72%_52%)] text-white hover:bg-[hsl(4_72%_45%)]"
              disabled={pending !== null}
              onClick={() => tap("arrived")}
            >
              {pending === "arrived" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "I'm here"
              )}
            </Button>
          </div>
        )}

        {errMsg && submission && (
          <p className="text-xs text-destructive text-center mt-4">{errMsg}</p>
        )}
      </main>

      <footer className="text-center text-[11px] text-muted-foreground/70 pt-6">
        Powered by Autocurb
      </footer>
    </div>
  );
};

export default CustomerCheckIn;

/**
 * CallFeedback — customer-facing 1-tap rating page.
 *
 * Reached via /call-feedback/:token from the post-call SMS. The
 * token is gen_random_uuid() and lives only in that SMS, so the
 * link itself is the auth — no login needed. Designed to be
 * completable in <10 seconds on mobile.
 *
 * Flow:
 *   1. Fetch context via get_call_feedback_context RPC (vehicle,
 *      already-submitted check, dealer name).
 *   2. Render 5 big touch-targets. Tap once = score saved instantly.
 *   3. Optional one-line comment textarea after the tap.
 *   4. Submit via submit_call_feedback RPC.
 *
 * Score policy (set on the server):
 *   >=4  → +0.5 to every variant in this call's voice_call_variants_used
 *    3   →  0
 *   <=2  → -1.0 (variants are NOT auto-retired on a single low score)
 *
 * No auth check on the page — the RPC enforces token validity and
 * one-submission idempotency. Already-submitted flow shows a brief
 * "thanks, we got your feedback" without re-rendering the stars.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, Star, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

interface CallFeedbackContext {
  ok: boolean;
  reason?: string;
  customer_name?: string | null;
  vehicle_info?: string | null;
  started_at?: string | null;
  already_submitted?: boolean;
  dealer_display_name?: string | null;
  dealer_phone?: string | null;
}

export default function CallFeedback() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [ctx, setCtx]         = useState<CallFeedbackContext | null>(null);
  const [score, setScore]     = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      if (!token) {
        setError("missing_token");
        setLoading(false);
        return;
      }
      const { data, error: rpcErr } = await supabase.rpc("get_call_feedback_context", {
        _token: token,
      });
      if (cancel) return;
      if (rpcErr) {
        setError(rpcErr.message);
      } else {
        const rows = data as unknown as CallFeedbackContext[] | null;
        const result = rows?.[0] as CallFeedbackContext | undefined;
        setCtx(result ?? null);
        if (result?.already_submitted) setSubmitted(true);
      }
      setLoading(false);
    };
    void load();
    return () => { cancel = true; };
  }, [token]);

  const dealerLabel = ctx?.dealer_display_name || "our team";
  const firstName = useMemo(() => {
    if (!ctx?.customer_name) return "";
    return ctx.customer_name.split(" ")[0];
  }, [ctx?.customer_name]);

  const handleStarTap = async (n: number) => {
    setScore(n);
    if (n >= 4) {
      // Happy path — submit immediately, comment is optional.
      await submit(n, "");
    }
    // 1-3: keep the score selected and prompt for a comment so we
    // capture the WHY of a negative score.
  };

  const submit = async (chosenScore: number, chosenComment: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("submit_call_feedback", {
        _token: token,
        _score: chosenScore,
        _comment: chosenComment || null,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      const result = data as { ok: boolean; reason?: string };
      if (result?.ok) {
        setSubmitted(true);
      } else if (result?.reason === "already_submitted") {
        setSubmitted(true);
      } else {
        setError(result?.reason || "submit_failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <div className="text-center mt-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      </Page>
    );
  }

  if (error || !ctx?.ok) {
    return (
      <Page>
        <SEO title="Call Feedback" description="Rate your recent call" />
        <div className="text-center pt-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link expired</h1>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">
            We couldn't find that call. The link may have expired, or you may
            have already submitted feedback. {ctx?.dealer_phone && (
              <>If you'd like to talk to someone, call <a href={`tel:${ctx.dealer_phone}`} className="text-blue-600 underline">{ctx.dealer_phone}</a>.</>
            )}
          </p>
        </div>
      </Page>
    );
  }

  if (submitted) {
    return (
      <Page>
        <SEO title="Thanks for the feedback" description="Your call rating was recorded" />
        <div className="text-center pt-8">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Thanks{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-base text-slate-600 max-w-sm mx-auto">
            We use every rating to make the next call better. If you need to
            reach a human at {dealerLabel}, you can{" "}
            {ctx.dealer_phone ? (
              <a href={`tel:${ctx.dealer_phone}`} className="text-blue-600 underline">call us anytime</a>
            ) : (
              <span>reply to the SMS that sent you here</span>
            )}.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <SEO title="How was that call?" description="Quick rating from your recent call" />
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          How was that call{firstName ? `, ${firstName}` : ""}?
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          {ctx.vehicle_info ? `About your ${ctx.vehicle_info}.` : ""} One tap, then you're done.
        </p>

        {/* Star row */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = score != null && n <= score;
            return (
              <button
                key={n}
                type="button"
                disabled={submitting}
                onClick={() => void handleStarTap(n)}
                aria-label={`Rate ${n} out of 5`}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition ${
                  filled
                    ? "border-amber-400 bg-amber-50 scale-110"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <Star
                  className={`w-7 h-7 ${
                    filled ? "fill-amber-400 text-amber-400" : "text-slate-300"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-400 px-2 mb-6 max-w-[360px] mx-auto">
          <span>Bad</span>
          <span>Great</span>
        </div>

        {/* Comment + submit appears only after a 1-3 tap */}
        {score != null && score <= 3 && !submitting && (
          <div className="max-w-md mx-auto text-left">
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              What went wrong? (optional)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={400}
              placeholder="One sentence is enough — talked too fast, didn't listen, etc."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
            />
            <Button
              onClick={() => void submit(score, comment)}
              disabled={submitting}
              className="w-full mt-3"
            >
              {submitting ? "Sending…" : "Submit feedback"}
            </Button>
          </div>
        )}

        {ctx.dealer_phone && (
          <a
            href={`tel:${ctx.dealer_phone}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-slate-700 mt-8"
          >
            <Phone className="w-3.5 h-3.5" />
            Or call {dealerLabel}: {ctx.dealer_phone}
          </a>
        )}
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-8 flex items-start justify-center">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

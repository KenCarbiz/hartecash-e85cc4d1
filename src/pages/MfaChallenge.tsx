/**
 * MfaChallenge — second-factor verification during sign-in.
 *
 * Reached when ProtectedRoute detects:
 *   currentLevel === 'aal1' && nextLevel === 'aal2'
 * (i.e. the user has an enrolled MFA factor but the current session
 * is single-factor — they signed in with password but haven't
 * completed the TOTP challenge.)
 *
 * Flow:
 *   1. listFactors() → pick the first verified TOTP factor.
 *   2. challenge({ factorId }) → challengeId.
 *   3. User enters 6-digit code.
 *   4. verify({ factorId, challengeId, code }) → upgrades session
 *      to aal2.
 *   5. log_mfa_event('verified') and redirect back to where they
 *      came from (or /admin).
 *
 * On verify failure, we log 'failed' and let them retry. Three
 * consecutive failures sign the user out (force a fresh password
 * round-trip).
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

export default function MfaChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const dest = (location.state as { from?: string } | null)?.from || "/admin";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (cancel) return;
      if (listErr) {
        setErrorMsg(listErr.message);
        setPhase("error");
        return;
      }
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (!verified) {
        // No verified factor — the user shouldn't be here. Bounce
        // them through enrollment instead.
        navigate("/admin/mfa-setup", { replace: true });
        return;
      }
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
        factorId: verified.id,
      });
      if (cancel) return;
      if (chalErr || !chal) {
        setErrorMsg(chalErr?.message || "Couldn't start challenge");
        setPhase("error");
        return;
      }
      setFactorId(verified.id);
      setChallengeId(chal.id);
      setPhase("ready");
      setTimeout(() => inputRef.current?.focus(), 50);
    })();
    return () => { cancel = true; };
  }, [navigate]);

  const handleVerify = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;
    setVerifying(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (error) {
      const newFails = failureCount + 1;
      setFailureCount(newFails);
      setCode("");

      void supabase.rpc("log_mfa_event", {
        _event_kind: "failed",
        _factor_type: "totp",
        _metadata: { attempt: newFails },
      });

      if (newFails >= 3) {
        // Three strikes — sign out and force a fresh password flow.
        await supabase.auth.signOut();
        navigate("/admin/login", {
          replace: true,
          state: { mfa_locked: true },
        });
        return;
      }

      setErrorMsg(`Code didn't match. ${3 - newFails} attempt${newFails === 2 ? "" : "s"} left.`);
      setVerifying(false);
      // Re-issue a fresh challenge for the retry.
      const { data: chal } = await supabase.auth.mfa.challenge({ factorId });
      if (chal) setChallengeId(chal.id);
      setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }

    void supabase.rpc("log_mfa_event", {
      _event_kind: "verified",
      _factor_type: "totp",
      _metadata: {},
    });

    navigate(dest, { replace: true });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 flex items-start justify-center">
      <SEO title="Two-factor verification" description="Enter the code from your authenticator" />
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <ShieldCheck className="w-10 h-10 text-blue-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-slate-900">Verify it's you</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
            Enter the 6-digit code from your authenticator app to continue.
          </p>
        </div>

        {phase === "loading" && (
          <div className="text-center py-8 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="w-5 h-5 mb-1" />
            <div className="font-bold">Couldn't start verification</div>
            <div className="mt-1 text-[13px]">{errorMsg}</div>
            <Button size="sm" variant="outline" onClick={handleSignOut} className="mt-3">
              Back to login
            </Button>
          </div>
        )}

        {phase === "ready" && (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) void handleVerify();
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="font-mono text-center text-2xl tracking-[0.4em] h-12"
              autoComplete="one-time-code"
            />
            {errorMsg && (
              <div className="text-[12px] text-red-600 mt-2">{errorMsg}</div>
            )}
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || verifying}
              className="w-full mt-3"
            >
              {verifying ? "Verifying…" : "Verify"}
            </Button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full mt-3 text-[12.5px] text-slate-500 hover:text-slate-700"
            >
              Use a different account
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

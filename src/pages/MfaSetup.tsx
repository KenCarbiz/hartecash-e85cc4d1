/**
 * MfaSetup — TOTP enrollment for staff users.
 *
 * Flow:
 *   1. supabase.auth.mfa.enroll({ factorType: 'totp' })
 *      Returns a factor.id + factor.totp.qr_code (data URL of an SVG)
 *      and the secret for manual entry.
 *   2. User scans the QR with Authy / Google Authenticator / 1Password.
 *   3. User enters the 6-digit code.
 *   4. supabase.auth.mfa.challenge({ factorId }) → challengeId
 *   5. supabase.auth.mfa.verify({ factorId, challengeId, code })
 *   6. On success, log_mfa_event('enrolled') and redirect to /admin.
 *
 * If the user already has a verified factor, this page short-circuits
 * to /admin — re-enrollment requires the existing factor to be
 * deleted first (via the staff settings page).
 *
 * Reachable by: ProtectedRoute redirect when require_mfa_for_user
 * returns required=true, OR direct navigation from settings.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

interface EnrollData {
  factorId: string;
  qrSvg: string;
  secret: string;
  uri: string;
}

export default function MfaSetup() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"loading" | "enroll" | "verify" | "done" | "error">("loading");
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      // Short-circuit if a verified factor already exists.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp?.some((f) => f.status === "verified")) {
        if (!cancel) navigate("/admin", { replace: true });
        return;
      }

      // Clear any pending unverified factors so re-enrollment works.
      const stale = factors?.totp?.filter((f) => f.status !== "verified") ?? [];
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }

      // Enroll a fresh factor.
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (cancel) return;
      if (error || !data) {
        setErrorMsg(error?.message || "Enrollment failed");
        setPhase("error");
        return;
      }
      setEnroll({
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setPhase("enroll");
    })();
    return () => { cancel = true; };
  }, [navigate]);

  const handleVerify = async () => {
    if (!enroll || code.length !== 6) return;
    setVerifying(true);
    setErrorMsg(null);

    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: enroll.factorId,
    });
    if (chalErr || !chal) {
      setErrorMsg(chalErr?.message || "Challenge failed");
      setVerifying(false);
      return;
    }

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: chal.id,
      code,
    });
    if (verErr) {
      setErrorMsg(verErr.message || "Code didn't match. Try again.");
      setCode("");
      setVerifying(false);
      return;
    }

    // Success — log the event and bounce back to admin.
    await supabase.rpc("log_mfa_event", {
      _event_kind: "enrolled",
      _factor_type: "totp",
      _metadata: {},
    }).catch(() => {});

    setPhase("done");
    setTimeout(() => navigate("/admin", { replace: true }), 1200);
  };

  const copySecret = async () => {
    if (!enroll) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 flex items-start justify-center">
      <SEO title="Set up two-factor authentication" description="Add a second factor to protect customer data" />
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-slate-900">Set up two-factor</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
            Your dealership requires a second factor before accessing customer
            data. This takes ~30 seconds with any authenticator app.
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
            <div className="font-bold">Couldn't start enrollment</div>
            <div className="mt-1 text-[13px]">{errorMsg}</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/admin/login")}
              className="mt-3"
            >
              Back to login
            </Button>
          </div>
        )}

        {phase === "enroll" && enroll && (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-[12.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Step 1 — Scan the QR code
              </div>
              <div className="flex items-center justify-center bg-white p-2 rounded">
                <div
                  className="w-48 h-48"
                  dangerouslySetInnerHTML={{ __html: enroll.qrSvg }}
                />
              </div>
              <div className="text-[11.5px] text-slate-500 mt-2 leading-snug">
                Use Authy, Google Authenticator, 1Password, or any TOTP-compatible
                app. The QR encodes a secret unique to your account.
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-[12.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Or enter the secret manually
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[13px] bg-slate-50 rounded px-2 py-1.5 break-all">
                  {enroll.secret}
                </code>
                <Button size="sm" variant="outline" onClick={copySecret} className="h-8">
                  {secretCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-[12.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Step 2 — Enter the 6-digit code from your app
              </div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                {verifying ? "Verifying…" : "Verify and enable"}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <div className="font-bold text-emerald-900">
              Two-factor enabled
            </div>
            <div className="text-[13px] text-emerald-800 mt-1">
              Redirecting…
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

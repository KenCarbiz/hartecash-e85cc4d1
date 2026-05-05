import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, Loader2, MailX, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

/**
 * Clarity-tier email unsubscribe — Apple-minimal companion to the
 * generic Unsubscribe page. Keeps the same handle-email-unsubscribe
 * edge-fn behavior as legacy. Mounted by EmailUnsubscribe.tsx as a
 * top-level dispatch when landing_template === "clarity".
 */
const EmailUnsubscribeClarity = () => {
  const [searchParams] = useSearchParams();
  const { config } = useSiteConfig();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();
        if (!res.ok) setStatus("invalid");
        else if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus("success");
    } catch {
      setStatus("error");
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-[560px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.dealership_name} className="h-7 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">{config.dealership_name}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-5 md:px-8 py-12 md:py-14">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-5"
        >
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-zinc-400" aria-hidden="true" />
              <p className="text-sm text-zinc-500">Verifying your request…</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="w-10 h-10 mx-auto text-zinc-400" aria-hidden="true" />
              <h1 className="font-sans text-[28px] md:text-[36px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
                Unsubscribe
              </h1>
              <p className="text-sm text-zinc-500">
                Are you sure? You won't receive any more emails from us.
              </p>
              <Button
                onClick={handleUnsubscribe}
                disabled={processing}
                className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100 font-semibold"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Processing…
                  </>
                ) : (
                  "Confirm unsubscribe"
                )}
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mx-auto" aria-hidden="true">
                <CheckCircle className="w-8 h-8 text-emerald-500" strokeWidth={2} />
              </div>
              <h1 className="font-sans text-[28px] md:text-[36px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
                Unsubscribed
              </h1>
              <p className="text-sm text-zinc-500">
                You won't receive any more emails from us.
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle className="w-10 h-10 mx-auto text-zinc-400" aria-hidden="true" />
              <h1 className="font-sans text-[28px] md:text-[36px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
                Already unsubscribed
              </h1>
              <p className="text-sm text-zinc-500">No further emails will be sent.</p>
            </>
          )}

          {(status === "invalid" || status === "error") && (
            <>
              <AlertCircle className="w-10 h-10 mx-auto text-zinc-400" aria-hidden="true" />
              <h1 className="font-sans text-[28px] md:text-[36px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
                {status === "invalid" ? "Invalid link" : "Something went wrong"}
              </h1>
              <p className="text-sm text-zinc-500">
                {status === "invalid"
                  ? "This unsubscribe link is invalid or has expired."
                  : "We couldn't process your request. Please try again later."}
              </p>
            </>
          )}
        </motion.section>
      </main>
    </div>
  );
};

export default EmailUnsubscribeClarity;

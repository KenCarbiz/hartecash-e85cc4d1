import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, AlertCircle, Mail, MessageSquare, ShieldOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Clarity-tier unsubscribe page — Apple-minimal. Mounted by
 * Unsubscribe.tsx as a top-level dispatch when landing_template ===
 * "clarity". Same handle-unsubscribe edge fn behavior as legacy.
 */
const UnsubscribeClarity = () => {
  const [searchParams] = useSearchParams();
  const { config } = useSiteConfig();
  const token = searchParams.get("token");
  const channelParam = searchParams.get("channel") || "all";

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ name?: string; vehicle?: string }>({});
  const [selectedChannel, setSelectedChannel] = useState(channelParam);

  const handleUnsubscribe = async (channel: string) => {
    if (!token) return;
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-unsubscribe", {
        body: { token, channel },
      });
      if (error) throw error;
      setResult(data || {});
      setStatus("success");
      setSelectedChannel(channel);
    } catch {
      setStatus("error");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900 px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="w-10 h-10 mx-auto text-zinc-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">Invalid link</h1>
          <p className="text-sm text-zinc-500">This unsubscribe link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-[560px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.dealership_name} className="h-16 md:h-20 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">{config.dealership_name}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-5 md:px-8 py-12 md:py-14 space-y-8">
        {status === "success" ? (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="text-center space-y-5"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50" aria-hidden="true">
              <CheckCircle className="w-8 h-8 text-emerald-500" strokeWidth={2} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Unsubscribed</p>
            <h1 className="font-sans text-[32px] md:text-[40px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
              {result.name ? `Done, ${result.name.split(" ")[0]}.` : "Done."}
            </h1>
            <p className="text-base text-zinc-500 leading-relaxed">
              You'll no longer receive{" "}
              {selectedChannel === "email" ? "email" : selectedChannel === "sms" ? "SMS" : "email or SMS"} follow-ups
              {result.vehicle ? ` about your ${result.vehicle}` : ""}.
            </p>
            {config.phone && (
              <p className="text-xs text-zinc-500">
                Change your mind?{" "}
                <a href={`tel:${config.phone}`} className="font-semibold text-zinc-900 hover:text-zinc-600 transition-colors">
                  Call {config.phone}
                </a>
              </p>
            )}
            <Link to="/">
              <Button variant="outline" className="rounded-full px-6 h-11 border-zinc-200 text-zinc-900 hover:bg-zinc-50">
                Back to home
              </Button>
            </Link>
          </motion.section>
        ) : (
          <>
            <section className="text-center space-y-3">
              <ShieldOff className="w-10 h-10 mx-auto text-zinc-400" aria-hidden="true" />
              <h1 className="font-sans text-[28px] md:text-[36px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
                Unsubscribe
              </h1>
              <p className="text-sm text-zinc-500">
                Choose which messages you'd like to stop receiving.
              </p>
            </section>

            <div className="space-y-2">
              <UnsubButton
                icon={Mail}
                label="Emails only"
                hint="You'll still get SMS messages"
                onClick={() => handleUnsubscribe("email")}
                disabled={status === "loading"}
              />
              <UnsubButton
                icon={MessageSquare}
                label="SMS only"
                hint="You'll still get email updates"
                onClick={() => handleUnsubscribe("sms")}
                disabled={status === "loading"}
              />
              <UnsubButton
                icon={ShieldOff}
                label="All communications"
                hint="Stop every email and SMS"
                onClick={() => handleUnsubscribe("all")}
                disabled={status === "loading"}
                emphasis
              />
            </div>

            {status === "loading" && (
              <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Processing…</span>
              </div>
            )}

            {status === "error" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                Something went wrong. Please try again
                {config.phone ? <> or call <a href={`tel:${config.phone}`} className="underline">{config.phone}</a></> : null}.
              </div>
            )}

            <p className="text-[11px] text-zinc-400 text-center">
              You can also reply STOP to any SMS to opt out instantly.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

interface UnsubButtonProps {
  icon: typeof Mail;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}

const UnsubButton = ({ icon: Icon, label, hint, onClick, disabled, emphasis }: UnsubButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all disabled:opacity-50 ${
      emphasis
        ? "border-zinc-900 hover:bg-zinc-50"
        : "border-zinc-200 hover:border-zinc-400"
    }`}
  >
    <Icon className={`w-5 h-5 shrink-0 ${emphasis ? "text-zinc-900" : "text-zinc-500"}`} aria-hidden="true" />
    <div>
      <p className="text-sm font-semibold text-zinc-900">{label}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>
    </div>
  </button>
);

export default UnsubscribeClarity;

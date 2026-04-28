import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Save, Mail, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InstallSnippet — the "install once, change forever" Phase-6 surface.
 *
 * The dealer's web provider pastes ONE script tag on every page (or in
 * the site template). Forever after, every change made inside the
 * Autocurb admin (button color, copy, sale banner, active assets)
 * propagates to the live site within ~30 seconds — no provider call,
 * no code change.
 *
 * Two actions:
 *   1. Save Settings → persists the in-component embed config to
 *      site_config.embed_config so the runtime endpoint serves it.
 *   2. Copy Snippet  → puts the install snippet on the clipboard,
 *      ready to email to the web provider.
 *
 * Plus a templated "email body" the rep can copy and send.
 */

interface Props {
  tenant: { dealership_id: string; display_name: string };
  buttonColor: string;
  buttonText: string;
  openMode: string;
  widgetPosition: string;
  stickyText: string;
  stickyCtaText: string;
  stickyPosition: string;
  bannerHeadline: string;
  bannerText: string;
  bannerCtaText: string;
  pptEnabled: boolean;
  pptButtonText: string;
}

const InstallSnippet = ({
  tenant,
  buttonColor,
  buttonText,
  openMode,
  widgetPosition,
  stickyText,
  stickyCtaText,
  stickyPosition,
  bannerHeadline,
  bannerText,
  bannerCtaText,
  pptEnabled,
  pptButtonText,
}: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://hartecash.com";

  // The supabase functions URL is stored in the Vite env. We rebuild the
  // base from VITE_SUPABASE_URL so the snippet hardcodes the project.
  const supabaseUrl = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_SUPABASE_URL || "";
  const configUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/embed-config`
    : "/api/embed-config";

  const installSnippet = `<!-- Autocurb / HarteCash dynamic embed — install once, change forever -->
<script src="${origin}/embed-loader.js"
        data-tenant="${tenant.dealership_id}"
        data-config-url="${configUrl}"
        async></script>`;

  const emailTemplate = `Hi,

We're installing Autocurb's instant cash-offer widget on ${tenant.display_name}.
Please paste the script tag below onto every page of the site (or in the global
template / footer include — wherever the site's other third-party scripts live).

This is a one-time install. Going forward, any change we make inside our
Autocurb admin (button color, copy, sale banner, etc.) will appear on the
live site automatically within about 30 seconds — no further code changes
or developer time required.

Snippet to paste:

${installSnippet}

If you have any questions please let us know. Thanks!`;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase
        .from("site_config")
        .update({
          embed_config: {
            buttonColor,
            buttonText,
            openMode,
            widgetPosition,
            stickyText,
            stickyCtaText,
            stickyPosition,
            bannerHeadline,
            bannerText,
            bannerCtaText,
            pptEnabled,
            pptButtonText,
            // activeAssets: derived for now — will become a per-tenant
            // toggle once the dealer can opt in/out of individual surfaces
            // from the EmbedToolkit. Defaults match what the loader does
            // out of the box.
            activeAssets: ["iframe", "widget", "sticky"],
          },
        })
        .eq("dealership_id", tenant.dealership_id);

      if (error) throw new Error(error.message);
      setSavedAt(new Date());
      toast({
        title: "Embed settings saved",
        description: "Your live site will pick up the changes within 30 seconds.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setSaveError(msg);
      toast({
        title: "Couldn't save embed settings",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (
    text: string,
    setFlag: (b: boolean) => void,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      window.setTimeout(() => setFlag(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Select the text and copy manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-violet-50 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700 leading-relaxed">
          <strong>Install once, change forever.</strong> Save your settings
          below, then send your web provider the install snippet. After that,
          any color, copy, or sale-banner change you make in this admin will
          appear on your live site within ~30 seconds — no developer time.
        </div>
      </div>

      {/* Save settings */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Step 1 — Save current settings
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Pushes button color / copy / sticky text / banner text to the
              runtime config endpoint.
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
        {savedAt && !saveError && (
          <div className="text-[11px] text-emerald-700 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Saved at{" "}
            {savedAt.toLocaleTimeString()}. The live site will reflect these
            changes within 30 seconds.
          </div>
        )}
        {saveError && (
          <div className="text-[11px] text-rose-700 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> {saveError}
          </div>
        )}
      </div>

      {/* Snippet */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Step 2 — Send this snippet to your web provider
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              They paste it once. After that you control everything from this
              admin.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(installSnippet, setCopiedSnippet)}
            className="gap-1.5"
          >
            {copiedSnippet ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiedSnippet ? "Copied" : "Copy Snippet"}
          </Button>
        </div>
        <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words">
          {installSnippet}
        </pre>
      </div>

      {/* Email template */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Step 3 (optional) — Pre-written email to your web provider
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Copy this entire body into your email. Snippet is embedded.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(emailTemplate, setCopiedEmail)}
            className="gap-1.5"
          >
            {copiedEmail ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {copiedEmail ? "Copied" : "Copy Email"}
          </Button>
        </div>
        <Textarea
          value={emailTemplate}
          readOnly
          rows={14}
          className="text-[11px] font-mono leading-relaxed"
        />
      </div>
    </div>
  );
};

export default InstallSnippet;

/**
 * InstallPanel (Admin V2) — the "give this to your web provider" experience.
 *
 * Auto-vertical install UX: lead with a provider chooser (not raw code),
 * pre-fill the real embed snippet with the dealer's tenant id, and offer
 * Copy / Email-to-developer / Send-to-provider. The raw code is collapsed
 * behind a reveal. Uses the SAME working snippet TradeWidgetAdmin emits
 * (embed-loader.js + data-tenant), so "Copy" produces real, valid code.
 *
 * Live install verification (heartbeat/crawl) is Phase 2 (needs a
 * backend beacon) — surfaced here as a clearly-labelled "Soon" with an
 * "open my site" manual check in the meantime.
 */
import { useMemo, useState } from "react";
import {
  Copy, Check, Mail, Send, Code2, ChevronDown, ExternalLink, ShieldCheck,
  Globe, Store, Wrench, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, SectionLabel, Pill, PrimaryButton, SecondaryButton } from "./theme";

type Access = "direct" | "provider" | "gtm";
type Provider = {
  id: string;
  name: string;
  icon: typeof Globe;
  access: Access;
  steps: string[];
};

const PROVIDERS: Provider[] = [
  { id: "dealercom", name: "Dealer.com", icon: Store, access: "provider", steps: [
    "Dealer.com routes third-party scripts through its tagging / GTM service.",
    "Create a “Value Your Trade” page (standard header/footer, empty body) and add a nav link to it.",
    "Send the snippet to your Dealer.com rep to add site-wide before </body> (or via your GTM container).",
  ] },
  { id: "dealeron", name: "DealerOn", icon: Store, access: "provider", steps: [
    "DealerOn manages your GTM container — most stores can't self-edit page HTML.",
    "Send the snippet to DealerOn support to add before </body> on all pages.",
    "Faster long-term: request an OnMarketplace listing so it installs in one click.",
  ] },
  { id: "dealerinspire", name: "Dealer Inspire", icon: Store, access: "provider", steps: [
    "Dealer Inspire (Cars.com) adds third-party scripts through support.",
    "Send the snippet to your Dealer Inspire rep to place before </body> site-wide.",
  ] },
  { id: "dealereprocess", name: "Dealer eProcess", icon: Code2, access: "direct", steps: [
    "Open your site admin → Custom HTML / Scripts area.",
    "Paste the snippet so it loads before </body> on every page.",
    "Add the Value My Trade button wherever you want the CTA.",
  ] },
  { id: "fusionzone", name: "fusionZONE", icon: Store, access: "provider", steps: [
    "Send the snippet to your fusionZONE rep to add before </body> site-wide.",
  ] },
  { id: "wordpress", name: "WordPress", icon: Globe, access: "direct", steps: [
    "Install a header/footer scripts plugin (e.g. WPCode or “Insert Headers and Footers”).",
    "Paste the snippet into the Footer / before-</body> box and save.",
  ] },
  { id: "gtm", name: "Google Tag Manager", icon: Layers, access: "gtm", steps: [
    "In GTM, create a new Custom HTML tag and paste the snippet.",
    "Set the trigger to All Pages and publish the container.",
    "Note: GTM-delivered scripts load slightly later — verification can lag a minute.",
  ] },
  { id: "other", name: "Other / My developer", icon: Wrench, access: "direct", steps: [
    "Paste the snippet so it loads before the </body> tag on every page.",
    "Add <button data-hartecash-trade> wherever you want the CTA to appear.",
  ] },
];

const ACCESS_BADGE: Record<Access, { tone: "green" | "amber" | "purple"; label: string }> = {
  direct: { tone: "green", label: "Direct HTML" },
  provider: { tone: "amber", label: "Via provider" },
  gtm: { tone: "purple", label: "Via GTM" },
};

const InstallPanel = ({ dealershipId, width = 420 }: { dealershipId: string; width?: number }) => {
  const { toast } = useToast();
  const [providerId, setProviderId] = useState("other");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://autocurb.io";
  const provider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[PROVIDERS.length - 1];

  const snippet = useMemo(
    () => `<!-- AutoCurb trade-in widget -->
<script src="${origin}/embed-loader.js" data-tenant="${dealershipId}" async></script>

<!-- Place near your price on a VDP / anywhere you want a "Value My Trade" CTA -->
<button data-hartecash-trade>Value My Trade</button>

<script>
  window.addEventListener('load', function () {
    HarteCash.bindTrade({ dealerId: '${dealershipId}', width: ${width} });
  });
</script>`,
    [origin, dealershipId, width],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: "Copied", description: "Install snippet is on your clipboard." });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  const placement = "Please add this to every page, just before the closing </body> tag.";
  const mailto = (to: string, subject: string) =>
    `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `${placement}\n\n${snippet}\n\nThis is the AutoCurb trade-in widget for our website. It's one async line and won't slow the site down. Thank you!`,
    )}`;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionLabel>Install on your website</SectionLabel>
          <div className="mt-1 text-[15px] font-semibold text-[#06194A]">Where is your site hosted?</div>
        </div>
        <Pill tone="purple">No code edits needed</Pill>
      </div>

      {/* Provider chooser */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDERS.map((p) => {
          const active = p.id === providerId;
          return (
            <button
              key={p.id}
              onClick={() => setProviderId(p.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition",
                active ? "border-[#6D28D9] bg-[#F3F0FF] text-[#6D28D9]" : "border-[#E6EAF0] text-[#3B4763] hover:border-[#6D28D9]/30",
              )}
            >
              <p.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Selected provider steps */}
      <div className="mt-4 rounded-xl border border-[#E6EAF0] bg-[#FAFBFD] p-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#06194A]">{provider.name}</span>
          <Pill tone={ACCESS_BADGE[provider.access].tone}>{ACCESS_BADGE[provider.access].label}</Pill>
        </div>
        <ol className="mt-2 space-y-1.5">
          {provider.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-[#3B4763]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF0FF] text-[11px] font-bold text-[#6D28D9]">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton onClick={copy}>
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy code</>}
        </PrimaryButton>
        <a href={mailto("", "Please install the AutoCurb trade-in widget on our site")}>
          <SecondaryButton><Mail className="h-4 w-4" /> Email to my developer</SecondaryButton>
        </a>
        {provider.access !== "direct" && (
          <a href={mailto("", `Please add the AutoCurb widget to our ${provider.name} site`)}>
            <SecondaryButton><Send className="h-4 w-4" /> Send to {provider.name}</SecondaryButton>
          </a>
        )}
        <button onClick={() => setShowCode((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#53627A] hover:text-[#6D28D9]">
          <Code2 className="h-4 w-4" /> {showCode ? "Hide code" : "View code"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showCode && "rotate-180")} />
        </button>
      </div>

      {/* Collapsed raw snippet */}
      {showCode && (
        <pre className="mt-3 overflow-x-auto rounded-xl border border-[#E6EAF0] bg-[#0B1020] p-4 text-[12px] leading-relaxed text-[#E6EAF0]">
          <code>{snippet}</code>
        </pre>
      )}

      {/* Verify */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F0F2F7] px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-[#3B4763]">
          <ShieldCheck className="h-4 w-4 text-[#9AA6BC]" />
          Installed it? Check your live site, then verify.
        </div>
        <div className="flex items-center gap-2">
          <a href={`${origin}/embed/${encodeURIComponent(dealershipId)}`} target="_blank" rel="noreferrer">
            <SecondaryButton><ExternalLink className="h-4 w-4" /> Preview widget</SecondaryButton>
          </a>
          <Pill tone="gray">Auto-verify soon</Pill>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-[#9AA6BC]">
        It's one async line and won't slow the site down. Make sure your site is served over HTTPS — mixed
        (http) embeds get blocked.
      </p>
    </Card>
  );
};

export default InstallPanel;

// Admin · Trade Widget — tenant-specific home for the embeddable
// trade/sell slide-out: live preview, one-click "try the slide-out",
// the copy-paste install snippet, and a read-out of the dealer settings
// the widget honors (so staff can see/adjust how it behaves).
//
// Scoped entirely to the admin's active dealership via useTenant().

import { useEffect, useRef, useState } from "react";
import {
  PanelRightOpen, Copy, Check, ExternalLink, RefreshCw, Car, Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useFormConfig } from "@/hooks/useFormConfig";

// A representative VDP vehicle so staff can preview the "apply your trade
// toward this car" framing without standing on a real inventory page.
const SAMPLE_VEHICLE = { label: "2026 Toyota Tacoma i-FORCE MAX Limited", msrp: 62995 };

export default function TradeWidgetAdmin() {
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const { formConfig } = useFormConfig();

  const dealershipId = tenant.dealership_id;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const [onVdp, setOnVdp] = useState(true);
  const [intent, setIntent] = useState<"trade" | "sell">("trade");
  const [previewKey, setPreviewKey] = useState(0); // bump to reload iframe
  const [copied, setCopied] = useState(false);
  // Slide-out width preset — matches the real panel sizes a dealer can ship.
  const SIZES = [
    { id: "compact", label: "Compact", px: 400 },
    { id: "standard", label: "Standard", px: 460 },
    { id: "wide", label: "Wide", px: 560 },
  ] as const;
  const [sizeId, setSizeId] = useState<(typeof SIZES)[number]["id"]>("standard");
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[1];

  // Offer aggressiveness / reveal mode live in offer_settings, not config.
  const [offer, setOffer] = useState<{ autoFirmPct: number | null; revealMode: string | null }>({
    autoFirmPct: null,
    revealMode: null,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("offer_settings")
        .select("auto_firm_offer_pct, pricing_reveal_mode")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (cancelled || !data) return;
      setOffer({
        autoFirmPct: (data as { auto_firm_offer_pct?: number | null }).auto_firm_offer_pct ?? null,
        revealMode: (data as { pricing_reveal_mode?: string | null }).pricing_reveal_mode ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [dealershipId]);

  const previewUrl = (() => {
    const p = new URLSearchParams({ template: "widget", intent });
    if (onVdp) {
      p.set("vehicle_label", SAMPLE_VEHICLE.label);
      p.set("vehicle_msrp", String(SAMPLE_VEHICLE.msrp));
    }
    return `${origin}/embed/${encodeURIComponent(dealershipId)}?${p.toString()}`;
  })();

  // Launch the REAL right-side slide-out over the admin page by loading
  // the embed script and calling the same opener a dealer site would.
  const launchedRef = useRef(false);
  const launchSlideOut = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const run = () =>
      w.HarteCash?.valueMyTrade({ dealerId: dealershipId, host: origin, width: size.px });
    if (w.HarteCash) return run();
    if (launchedRef.current) return;
    launchedRef.current = true;
    const s = document.createElement("script");
    s.src = `${origin}/embed.js`;
    s.async = true;
    s.onload = run;
    document.body.appendChild(s);
  };

  const snippet = `<!-- AutoCurb trade-in widget -->
<script src="${origin}/embed-loader.js" data-tenant="${dealershipId}" async></script>

<!-- Place near your price on a VDP / anywhere you want a "Value My Trade" CTA -->
<button data-hartecash-trade>Value My Trade</button>

<script>
  window.addEventListener('load', function () {
    HarteCash.bindTrade({ dealerId: '${dealershipId}', width: ${size.px} });
  });
</script>`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-1">
      <header>
        <h1 className="text-xl font-bold text-foreground">Trade Widget</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The embeddable trade/sell slide-out for{" "}
          <span className="font-medium text-foreground">{tenant.display_name}</span>. It follows the
          customer across the dealer site and, on a vehicle page, invites them to apply their firm
          offer as a trade-in toward that car.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Live preview ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Live preview</h2>
            <div className="flex items-center gap-1.5">
              <ToggleChip active={onVdp} onClick={() => { setOnVdp((v) => !v); setPreviewKey((k) => k + 1); }}>
                <Car className="h-3.5 w-3.5" /> On a vehicle page
              </ToggleChip>
              <ToggleChip active={intent === "trade"} onClick={() => { setIntent("trade"); setPreviewKey((k) => k + 1); }}>
                Trade
              </ToggleChip>
              <ToggleChip active={intent === "sell"} onClick={() => { setIntent("sell"); setPreviewKey((k) => k + 1); }}>
                Sell
              </ToggleChip>
              <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" aria-hidden />
              {SIZES.map((s) => (
                <ToggleChip
                  key={s.id}
                  active={sizeId === s.id}
                  onClick={() => { setSizeId(s.id); setPreviewKey((k) => k + 1); }}
                >
                  {s.label} <span className="text-[10px] text-muted-foreground">{s.px}px</span>
                </ToggleChip>
              ))}
              <button
                type="button"
                onClick={() => setPreviewKey((k) => k + 1)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                title="Reload preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Phone-ish frame so the panel reads at its real width. */}
          <div className="flex justify-center rounded-xl bg-muted/40 p-4">
            <iframe
              key={previewKey}
              title="Trade widget preview"
              src={previewUrl}
              style={{ width: size.px }}
              className="h-[700px] max-w-full rounded-xl border border-border bg-white shadow-sm"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={launchSlideOut}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <PanelRightOpen className="h-4 w-4" /> Launch the slide-out here
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" /> Open in new tab
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            "Launch" opens the real right-side panel over this page — exactly what a customer sees
            after tapping <span className="font-medium">Value My Trade</span> on the dealer site.
          </p>
        </section>

        {/* ── Install + settings ───────────────────────────────────── */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Install on the dealer site</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Paste once. Add <code className="rounded bg-muted px-1">data-hartecash-trade</code> to
              any existing button (e.g. "Value My Trade") to open the panel.
            </p>
            <pre className="max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-100">
              <code>{snippet}</code>
            </pre>
            <button
              type="button"
              onClick={copySnippet}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              {copied ? <><Check className="h-4 w-4 text-emerald-600" /> Copied</> : <><Copy className="h-4 w-4" /> Copy snippet</>}
            </button>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Settings2 className="h-4 w-4" /> Behavior (from your settings)
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              The widget uses the same waterfall valuation and admin settings as your main site —
              change these in their own sections and the widget follows.
            </p>
            <ul className="space-y-2 text-sm">
              <SettingRow
                label="SMS code before firm offer"
                value={formConfig.require_phone_verification !== false ? "On" : "Off"}
                hint="Form Configuration"
              />
              <SettingRow
                label="AI photo boost"
                value={formConfig.step_ai_photos !== false ? "On" : "Off"}
                hint="Form Configuration"
              />
              <SettingRow
                label="Collect contact before offer"
                value={formConfig.offer_before_details === true ? "After offer" : "Before offer"}
                hint="Form Configuration"
              />
              <SettingRow
                label="Offer aggressiveness (auto-firm)"
                value={offer.autoFirmPct != null ? `${Math.round(offer.autoFirmPct * 100)}% of high` : "Manager-set"}
                hint="Offer Settings"
              />
              <SettingRow
                label="Locked-in window"
                value={`${Number((config as { price_guarantee_days?: number }).price_guarantee_days) || 8} days`}
                hint="Branding / Site Config"
              />
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SettingRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
        {value}
      </span>
    </li>
  );
}

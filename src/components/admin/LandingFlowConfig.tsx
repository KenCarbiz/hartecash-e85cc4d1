import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Layout, Sparkles, Zap, ListChecks, Smartphone, Monitor, RefreshCw, ExternalLink } from "lucide-react";
import { LANDING_TEMPLATES, type LandingTemplate } from "@/hooks/useSiteConfig";
import TemplateThumbnail from "@/components/landing/TemplateThumbnail";
import GhostScreen, { type GhostScreenKind } from "@/components/landing/GhostScreen";
import { Input } from "@/components/ui/input";
import PayoutMethodsConfig from "@/components/admin/PayoutMethodsConfig";
import { useFormConfig } from "@/hooks/useFormConfig";

type FormVariant = "detailed" | "quick";

const FORM_VARIANTS: Array<{
  value: FormVariant;
  label: string;
  description: string;
  icon: typeof Zap;
}> = [
  {
    value: "detailed",
    label: "Detailed step-by-step",
    description:
      "The classic multi-step form: vehicle → trim → condition → history → contact. Highest data quality, longer time-to-offer.",
    icon: ListChecks,
  },
  {
    value: "quick",
    label: "60-second one-screen",
    description:
      "Plate or VIN + ZIP + mileage + two yes/no condition Q's on a single screen. Conversion-tuned, Carvana-style. Customers land on the offer page in seconds.",
    icon: Zap,
  },
];

/**
 * LandingFlowConfig — Landing & Flow admin page.
 *
 * Houses the landing-page template picker. Pricing Reveal, Range
 * Configuration, and Payment Selection Timing used to live here too but
 * were moved to the Lead Form admin so everything that touches the
 * customer form — step toggles, pricing reveal, payment timing — is in
 * one place. Per-location template overrides still live in the
 * dealership_locations admin.
 */

type FormDensity = "simple" | "standard" | "detailed" | "dealer_configured";
type ConditionCardStyle = "basic" | "kbb";

interface State {
  landing_template: LandingTemplate;
  landing_form_variant: FormVariant;
  landing_form_density: FormDensity;
  /** Whether this dealer offers free at-home pickup. Drives the
   *  HowItWorks step 3 + the default "Why X Wins" wedge row. When
   *  off, the customer-facing copy switches to in-person drop-off. */
  pickup_offered: boolean;
  /** Three-state handoff configuration: what the dealer offers
   *  customers after they accept the offer. */
  handoff_type: "pickup" | "dropoff" | "both";
  /** Customer-facing condition picker style — "basic" hint per
   *  option vs. "kbb" KBB-style descriptions + key dialog. */
  condition_card_style: ConditionCardStyle;
  /** Ghost-screen variant + optional copy overrides for the
   *  BB-lookup transition state. */
  ghost_screen: GhostScreenKind;
  ghost_headline: string;
  ghost_subhead: string;
  /** Which lookup tab opens by default on the landing cluster. */
  landing_lookup_default: "plate" | "vin";
  /** Optional dealer override for the CTA button background (hex). */
  landing_cta_color: string;
  /** Optional dealer override for the CTA button text color (hex). */
  landing_cta_text_color: string;
}

const DEFAULTS: State = {
  landing_template: "classic",
  landing_form_variant: "detailed",
  landing_form_density: "simple",
  pickup_offered: true,
  handoff_type: "both",
  condition_card_style: "basic",
  ghost_screen: "legacy-car",
  ghost_headline: "",
  ghost_subhead: "",
  landing_lookup_default: "plate",
  landing_cta_color: "",
  landing_cta_text_color: "",
};

const GHOST_OPTIONS: { value: GhostScreenKind; label: string; description: string; recommended?: boolean }[] = [
  { value: "legacy-car",    label: "Hartecash Classic",     description: "The official Hartecash ghost-car illustration bouncing over a scrolling dashed road. The default — used everywhere on the live site.", recommended: true },
  { value: "pulse-orb",     label: "Pulse Orb",             description: "Concentric rings pulsing outward from a solid center. Apple Vision Pro / OpenAI vibe — calm, premium, geometric." },
  { value: "sweep-arc",     label: "Sweep Arc",             description: "Thin quarter-arc rotating with a soft trailing gradient. Stripe / Linear / Vercel — minimal, fast-feeling." },
  { value: "stack-reveal",  label: "Stack Reveal",          description: "Four horizontal bars filling left-to-right in sequence. Vercel deploy / Notion publish — clearly progressing." },
  { value: "card-skeleton", label: "Vehicle Card",          description: "Vehicle-card placeholder with a diagonal shimmer sweep. Edmunds / Carvana — industry-standard pattern." },
];

const LandingFlowConfig = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formConfig } = useFormConfig();

  const [state, setState] = useState<State>(DEFAULTS);
  const [saved, setSaved] = useState<State>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Tile preview mode — schematic (SVG thumbnails) or live
  // (lazy iframes). Persisted in sessionStorage so flipping tabs
  // in the admin doesn't reset the dealer's choice.
  // Default to "live" so the dealer sees real screenshots of all
  // 20 templates without having to find + flip a toggle. The
  // schematic mode is still available for slow connections / when
  // the dealer wants the abstract layout-only view.
  const [tilePreviewMode, _setTilePreviewMode] = useState<"schematic" | "live">(() => {
    try {
      return (sessionStorage.getItem("__landing_tile_mode") as "schematic" | "live") || "live";
    } catch { return "live"; }
  });
  const setTilePreviewMode = (m: "schematic" | "live") => {
    _setTilePreviewMode(m);
    try { sessionStorage.setItem("__landing_tile_mode", m); } catch { /* private mode */ }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Ask for both columns first; if landing_form_variant isn't
      // deployed yet on this environment, fall back to template-only
      // so the page still loads instead of bailing out with a generic
      // schema-cache error.
      let row: any = null;
      const wide = await supabase
        .from("site_config")
        .select("landing_template, landing_form_variant, landing_form_density, pickup_offered, handoff_type, condition_card_style, ghost_screen, ghost_headline, ghost_subhead, landing_lookup_default, landing_cta_color, landing_cta_text_color")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (wide.error) {
        const lower = wide.error.message?.toLowerCase() || "";
        if (
          lower.includes("landing_form_variant") ||
          lower.includes("landing_form_density") ||
          lower.includes("pickup_offered") ||
          lower.includes("handoff_type") ||
          lower.includes("condition_card_style") ||
          lower.includes("ghost_screen") ||
          lower.includes("ghost_headline") ||
          lower.includes("ghost_subhead") ||
          lower.includes("landing_lookup_default") ||
          lower.includes("schema cache")
        ) {
          const narrow = await supabase
            .from("site_config")
            .select("landing_template")
            .eq("dealership_id", dealershipId)
            .maybeSingle();
          row = narrow.data;
        }
      } else {
        row = wide.data;
      }
      const next: State = {
        landing_template:
          (row?.landing_template as LandingTemplate) || DEFAULTS.landing_template,
        landing_form_variant:
          (row?.landing_form_variant as FormVariant) || DEFAULTS.landing_form_variant,
        landing_form_density:
          (row?.landing_form_density as FormDensity) || DEFAULTS.landing_form_density,
        pickup_offered:
          row?.pickup_offered === false ? false : DEFAULTS.pickup_offered,
        condition_card_style:
          (row?.condition_card_style as ConditionCardStyle) ||
          DEFAULTS.condition_card_style,
        ghost_screen:
          (row?.ghost_screen as GhostScreenKind) || DEFAULTS.ghost_screen,
        ghost_headline: row?.ghost_headline ?? DEFAULTS.ghost_headline,
        ghost_subhead: row?.ghost_subhead ?? DEFAULTS.ghost_subhead,
        landing_lookup_default:
          (row?.landing_lookup_default as "plate" | "vin") ||
          DEFAULTS.landing_lookup_default,
        landing_cta_color: row?.landing_cta_color ?? DEFAULTS.landing_cta_color,
        landing_cta_text_color:
          row?.landing_cta_text_color ?? DEFAULTS.landing_cta_text_color,
      };
      setState(next);
      setSaved(next);
      setLoading(false);
    })();
  }, [dealershipId]);

  const dirty =
    state.landing_template !== saved.landing_template ||
    state.landing_form_variant !== saved.landing_form_variant ||
    state.landing_form_density !== saved.landing_form_density ||
    state.pickup_offered !== saved.pickup_offered ||
    state.condition_card_style !== saved.condition_card_style ||
    state.ghost_screen !== saved.ghost_screen ||
    state.ghost_headline !== saved.ghost_headline ||
    state.ghost_subhead !== saved.ghost_subhead ||
    state.landing_lookup_default !== saved.landing_lookup_default ||
    state.landing_cta_color !== saved.landing_cta_color ||
    state.landing_cta_text_color !== saved.landing_cta_text_color;

  const handleSave = async () => {
    setSaving(true);

    // Save in two passes so a missing landing_form_variant column on
    // not-yet-migrated DBs never blocks the template change.
    //   1) Always-safe pass: template + updated_at (columns shipped
    //      with migration 20260419 — present everywhere).
    //   2) Best-effort pass: variant only (column shipped with
    //      20260430010000 — may not be deployed yet). On failure we
    //      detect the missing column and tell the admin instead of
    //      raising a generic destructive toast.

    const tmplChanged = state.landing_template !== saved.landing_template;
    const variantChanged = state.landing_form_variant !== saved.landing_form_variant;

    // Pass 1 — template
    if (tmplChanged) {
      const { error: tmplErr } = await supabase
        .from("site_config")
        .update({
          landing_template: state.landing_template,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (tmplErr) {
        setSaving(false);
        const lower = tmplErr.message?.toLowerCase() || "";
        const looksLikeMissing =
          lower.includes("landing_template") ||
          lower.includes("schema cache") ||
          (lower.includes("column") && lower.includes("does not exist"));
        toast({
          title: looksLikeMissing ? "Landing settings not yet provisioned" : "Save failed",
          description: looksLikeMissing
            ? "The landing_template column hasn't been added to this environment yet. Apply migration 20260419000000_landing_templates_and_offer_flow.sql or refresh the PostgREST schema cache, then try again."
            : tmplErr.message,
          variant: "destructive",
        });
        return;
      }
    }

    // Pass 1.5 — density (best-effort, may not be deployed yet)
    const densityChanged = state.landing_form_density !== saved.landing_form_density;
    let densitySkipped = false;
    if (densityChanged) {
      const { error: dErr } = await supabase
        .from("site_config")
        .update({
          landing_form_density: state.landing_form_density,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (dErr) {
        const lower = dErr.message?.toLowerCase() || "";
        const code = dErr.code || "";
        const missingDensity =
          lower.includes("landing_form_density") ||
          lower.includes("schema cache") ||
          code === "PGRST204" ||
          (lower.includes("column") && lower.includes("does not exist"));
        if (!missingDensity) {
          setSaving(false);
          toast({ title: "Save failed", description: dErr.message, variant: "destructive" });
          return;
        }
        densitySkipped = true;
      }
    }

    // Pass 1.65 — landing_lookup_default (best-effort)
    const lookupChanged =
      state.landing_lookup_default !== saved.landing_lookup_default;
    let lookupSkipped = false;
    if (lookupChanged) {
      const { error: lErr } = await supabase
        .from("site_config")
        .update({
          landing_lookup_default: state.landing_lookup_default,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (lErr) {
        const lower = lErr.message?.toLowerCase() || "";
        const code = lErr.code || "";
        const missingLookup =
          lower.includes("landing_lookup_default") ||
          lower.includes("landing_cta_color") ||
          lower.includes("schema cache") ||
          code === "PGRST204" ||
          (lower.includes("column") && lower.includes("does not exist"));
        if (!missingLookup) {
          setSaving(false);
          toast({ title: "Save failed", description: lErr.message, variant: "destructive" });
          return;
        }
        lookupSkipped = true;
      }
    }

    // Pass 1.66 — landing CTA colors (button bg + text, both best-effort)
    const ctaColorChanged =
      state.landing_cta_color !== saved.landing_cta_color ||
      state.landing_cta_text_color !== saved.landing_cta_text_color;
    let ctaColorSkipped = false;
    if (ctaColorChanged) {
      const { error: cErr } = await supabase
        .from("site_config")
        .update({
          landing_cta_color: state.landing_cta_color.trim() || null,
          landing_cta_text_color: state.landing_cta_text_color.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (cErr) {
        const lower = cErr.message?.toLowerCase() || "";
        const code = cErr.code || "";
        const missing =
          lower.includes("landing_cta_color") ||
          lower.includes("landing_cta_text_color") ||
          lower.includes("schema cache") ||
          code === "PGRST204" ||
          (lower.includes("column") && lower.includes("does not exist"));
        if (!missing) {
          setSaving(false);
          toast({ title: "Save failed", description: cErr.message, variant: "destructive" });
          return;
        }
        ctaColorSkipped = true;
      }
    }

    // Pass 1.7 — ghost variant + copy. Each column writes
    // independently so that a single missing column (e.g. PostgREST
    // hasn't cached the new ghost_subhead yet) can't silently drop
    // the dealer's variant pick. Customer-flagged: picker was
    // "stuck on Vehicle Card" because the combined UPDATE failed
    // whenever ANY of the three columns was unknown to the schema
    // cache, dropping the ghost_screen value with it.
    const writeIfChanged = async (
      key: "ghost_screen" | "ghost_headline" | "ghost_subhead",
      newVal: unknown,
      oldVal: unknown,
    ): Promise<{ skipped: boolean; hardFailMsg?: string }> => {
      if (newVal === oldVal) return { skipped: false };
      const { error: e } = await supabase
        .from("site_config")
        .update({ [key]: newVal, updated_at: new Date().toISOString() })
        .eq("dealership_id", dealershipId);
      if (!e) return { skipped: false };
      const lower = e.message?.toLowerCase() || "";
      const code = e.code || "";
      const isCacheMiss =
        lower.includes(key) ||
        lower.includes("schema cache") ||
        code === "PGRST204" ||
        (lower.includes("column") && lower.includes("does not exist"));
      if (isCacheMiss) return { skipped: true };
      return { skipped: false, hardFailMsg: e.message };
    };

    const ghostScreenWrite = await writeIfChanged(
      "ghost_screen",
      state.ghost_screen,
      saved.ghost_screen,
    );
    if (ghostScreenWrite.hardFailMsg) {
      setSaving(false);
      toast({ title: "Save failed", description: ghostScreenWrite.hardFailMsg, variant: "destructive" });
      return;
    }
    const ghostHeadlineWrite = await writeIfChanged(
      "ghost_headline",
      state.ghost_headline.trim() || null,
      saved.ghost_headline,
    );
    if (ghostHeadlineWrite.hardFailMsg) {
      setSaving(false);
      toast({ title: "Save failed", description: ghostHeadlineWrite.hardFailMsg, variant: "destructive" });
      return;
    }
    const ghostSubheadWrite = await writeIfChanged(
      "ghost_subhead",
      state.ghost_subhead.trim() || null,
      saved.ghost_subhead,
    );
    if (ghostSubheadWrite.hardFailMsg) {
      setSaving(false);
      toast({ title: "Save failed", description: ghostSubheadWrite.hardFailMsg, variant: "destructive" });
      return;
    }
    // Track each ghost-column write outcome individually so the
    // setSaved finalize can roll back only the columns that didn't
    // actually persist (ghostScreenWrite.skipped is what matters
    // for the picker's "Live" state). The earlier coarse boolean-AND
    // ghostSkipped was wrong — when ghost_headline / ghost_subhead
    // returned skipped=false because they were unchanged, the AND
    // collapsed to false even when ghost_screen had been rejected,
    // and the bad write was silently treated as a successful one.

    // Pass 1.6 — pickup_offered (best-effort, may not be deployed yet)
    const pickupChanged = state.pickup_offered !== saved.pickup_offered;
    let pickupSkipped = false;
    if (pickupChanged) {
      const { error: pErr } = await supabase
        .from("site_config")
        .update({
          pickup_offered: state.pickup_offered,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (pErr) {
        const lower = pErr.message?.toLowerCase() || "";
        const code = pErr.code || "";
        const missingPickup =
          lower.includes("pickup_offered") ||
          lower.includes("schema cache") ||
          code === "PGRST204" ||
          (lower.includes("column") && lower.includes("does not exist"));
        if (!missingPickup) {
          setSaving(false);
          toast({ title: "Save failed", description: pErr.message, variant: "destructive" });
          return;
        }
        pickupSkipped = true;
      }
    }

    // Pass 1.61 — condition_card_style (best-effort, may not be deployed yet)
    const conditionStyleChanged =
      state.condition_card_style !== saved.condition_card_style;
    let conditionStyleSkipped = false;
    if (conditionStyleChanged) {
      const { error: cErr } = await supabase
        .from("site_config")
        .update({
          condition_card_style: state.condition_card_style,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (cErr) {
        const lower = cErr.message?.toLowerCase() || "";
        const code = cErr.code || "";
        const missing =
          lower.includes("condition_card_style") ||
          lower.includes("schema cache") ||
          code === "PGRST204" ||
          (lower.includes("column") && lower.includes("does not exist"));
        if (!missing) {
          setSaving(false);
          toast({ title: "Save failed", description: cErr.message, variant: "destructive" });
          return;
        }
        conditionStyleSkipped = true;
      }
    }

    // Pass 2 — variant (best-effort)
    let variantSkipped = false;
    if (variantChanged) {
      const { error: varErr } = await supabase
        .from("site_config")
        .update({
          landing_form_variant: state.landing_form_variant,
          updated_at: new Date().toISOString(),
        })
        .eq("dealership_id", dealershipId);
      if (varErr) {
        const lower = varErr.message?.toLowerCase() || "";
        const code = varErr.code || "";
        const missingVariant =
          lower.includes("landing_form_variant") ||
          lower.includes("schema cache") ||
          code === "PGRST204" ||
          (lower.includes("column") && lower.includes("does not exist"));
        if (!missingVariant) {
          // Genuine save error — surface it.
          setSaving(false);
          toast({ title: "Save failed", description: varErr.message, variant: "destructive" });
          return;
        }
        // Otherwise: silently skip and tell the admin.
        variantSkipped = true;
      }
    }

    setSaving(false);

    // Persist saved state. When the variant write was skipped the
    // saved snapshot keeps the old value so the toggle's "dirty"
    // state stays until the column is provisioned and a real save
    // lands.
    // Per-column rollback for the ghost section. The earlier
    // ghostSkipped logic (boolean AND of all three) was wrong: if
    // only ghost_screen got rejected by PostgREST but ghost_headline
    // and ghost_subhead saved cleanly (or were unchanged so they
    // returned skipped=false), the rollback was skipped entirely
    // and saved.ghost_screen ended up matching the local state
    // EVEN THOUGH THE DB STILL HAS THE OLD VALUE. The picker would
    // then show "Live" on the new pick while the public site kept
    // serving the old one. Customer-flagged: "active landing ghost
    // loader not working stuck on a different one".
    setSaved({
      ...state,
      ...(variantSkipped ? { landing_form_variant: saved.landing_form_variant } : {}),
      ...(densitySkipped ? { landing_form_density: saved.landing_form_density } : {}),
      ...(pickupSkipped ? { pickup_offered: saved.pickup_offered } : {}),
      ...(conditionStyleSkipped ? { condition_card_style: saved.condition_card_style } : {}),
      ...(lookupSkipped ? { landing_lookup_default: saved.landing_lookup_default } : {}),
      ...(ctaColorSkipped
        ? {
            landing_cta_color: saved.landing_cta_color,
            landing_cta_text_color: saved.landing_cta_text_color,
          }
        : {}),
      ...(ghostScreenWrite.skipped ? { ghost_screen: saved.ghost_screen } : {}),
      ...(ghostHeadlineWrite.skipped ? { ghost_headline: saved.ghost_headline } : {}),
      ...(ghostSubheadWrite.skipped ? { ghost_subhead: saved.ghost_subhead } : {}),
    });

    // Surface a clear warning when the variant pick itself was
    // rejected by PostgREST. Without this, the dealer thought their
    // pick had saved (Save toast fired) but it never landed.
    if (ghostScreenWrite.skipped) {
      toast({
        title: "Ghost loader not saved",
        description:
          "The ghost_screen column isn't reachable in PostgREST's schema cache. Apply migration 20260504040000_ghost_screen_admin.sql or re-run the schema-reload migration, then try again.",
        variant: "destructive",
      });
    }

    if (variantSkipped) {
      // Store the choice in localStorage so the admin can preview the
      // new flow in their own browser even before the migration is
      // applied. LandingForm checks this key as a fallback when the
      // DB column hasn't propagated yet. NOT visible to other
      // browsers / customers — that still needs the migration.
      try {
        localStorage.setItem(
          `landing_form_variant_pending:${dealershipId}`,
          state.landing_form_variant,
        );
      } catch { /* private mode: ignore */ }
      toast({
        title: tmplChanged ? "Template saved · variant stored locally" : "Variant stored locally",
        description:
          "Public Sell Flow column isn't deployed yet so the toggle didn't persist DB-wide. Saved your choice to this browser so you can preview it. Apply migration 20260430010000_landing_form_variant.sql to roll it out to all visitors.",
      });
    } else {
      // Successful real save — clear any local fallback so the DB
      // value becomes the source of truth again.
      try {
        localStorage.removeItem(`landing_form_variant_pending:${dealershipId}`);
      } catch { /* ignore */ }
      // Invalidate the public-facing useSiteConfig cache so the
      // landing reflects the dealer's new template / density /
      // pickup / ghost / lookup-default / cta-color choices on the
      // next request instead of waiting up to 5 min for staleness.
      queryClient.invalidateQueries({ queryKey: ["site_config"] });
      toast({ title: "Saved", description: "Landing page settings updated." });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary" /> Landing &amp; Flow
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick the landing-page layout your customers see. Locations can override
          the template in their own settings. Pricing reveal, range display, and
          payment-selection timing live on the <strong>Lead Form</strong> admin so
          every &quot;what the customer sees in the form&quot; decision is in one place.
        </p>
      </header>

      {/* ── Transaction Settings · Payout Methods ── */}
      <PayoutMethodsConfig />





      {/* ── Form variant picker ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Public Sell Flow</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Which form your landing page mounts. The detailed form captures
          richer condition data; the quick form maximizes conversion. You can
          switch back any time.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FORM_VARIANTS.map((v) => {
            const active = state.landing_form_variant === v.value;
            const Icon = v.icon;
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, landing_form_variant: v.value }))}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-muted/30 hover:bg-muted hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm flex-1">{v.label}</span>
                  {active && (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{v.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Flow Density picker ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-1">
          <Layout className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Flow Density</h3>
          <span className="ml-2 text-micro font-bold uppercase tracking-[0.18em] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            ★ New
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Pick the shape of the customer journey. The first three are tuned presets; pick <strong>Dealer Configured</strong> to build the journey entirely from your toggles below (form steps, condition questions, pricing reveal, payment timing).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            {
              value: "simple" as const,
              label: "Fast Conversion",
              tagline: "3 questions · 3 pages",
              body: "Minimal questions, highest completion rates, shortest journey.",
              recommended: true,
            },
            {
              value: "standard" as const,
              label: "Balanced",
              tagline: "5 questions · 3 pages",
              body: "Moderate qualification with better lead quality — still conversion-optimized.",
            },
            {
              value: "detailed" as const,
              label: "Full Appraisal",
              tagline: "Full Lead Form · 4–9 pages",
              body: "Full inspection-style acquisition flow with deep condition capture.",
            },
            {
              value: "dealer_configured" as const,
              label: "Dealer Configured",
              tagline: "Custom · driven by your toggles",
              body: "No preset. The journey is generated from the form steps and questions you enable below.",
            },
          ].map((d) => {
            const active = state.landing_form_density === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, landing_form_density: d.value }))}
                className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                    : "border-border bg-muted/30 hover:bg-muted hover:border-primary/30"
                }`}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{d.label}</span>
                  {active ? (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary">Active</span>
                  ) : d.recommended ? (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                      ★ Pick
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mb-2">{d.tagline}</div>
                <p className="text-xs text-muted-foreground leading-snug">{d.body}</p>
              </button>
            );
          })}
        </div>

        {state.landing_form_density === "dealer_configured" && (() => {
          // Dynamic summary derived from the dealer's existing form_config
          // toggles. Purely presentational — does not change any saved
          // values. Updates live as the dealer toggles questions/steps
          // in the Lead Form admin.
          const fc: any = formConfig || {};
          const questionKeys = Object.keys(fc).filter((k) => k.startsWith("q_"));
          const enabledQuestions = questionKeys.filter((k) => fc[k] === true).length;
          const stepKeys = ["step_vehicle_build", "step_condition_history", "step_ai_photos"];
          const enabledSteps = stepKeys.filter((k) => fc[k] === true).length;
          // Screens = Search + each enabled optional step + Contact + Offer.
          const screens = 1 + enabledSteps + 1 + 1;
          // Rough completion estimate: 8s per question + 12s per screen.
          const totalSec = enabledQuestions * 8 + screens * 12;
          const mins = Math.floor(totalSec / 60);
          const secs = totalSec % 60;
          const eta = mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
          const impact =
            enabledQuestions <= 4 ? { label: "High", tone: "text-emerald-600" } :
            enabledQuestions <= 8 ? { label: "Moderate", tone: "text-amber-600" } :
                                    { label: "Lower", tone: "text-rose-600" };

          return (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Estimated Customer Experience
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Questions</div>
                  <div className="font-bold">{enabledQuestions}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Screens</div>
                  <div className="font-bold">{screens}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Est. completion</div>
                  <div className="font-bold">{eta}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversion impact</div>
                  <div className={`font-bold ${impact.tone}`}>{impact.label}</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
                Updates live as you toggle questions and steps in <strong>Setup · Dealer · Lead Form</strong>. Presets are bypassed in this mode.
              </p>
            </div>
          );
        })()}
      </section>


      {/* ── Pickup toggle ──
          Drives "We pick up your car" copy on HowItWorks step 3 and the
          default Why-X-Wins wedge row. When off, those swap to in-person
          drop-off so the landing stays honest. */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🚚</span>
              <h3 className="font-bold">Free At-Home Pickup</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-prose">
              Toggle on if you offer free pickup of the car after the customer accepts
              the offer. Drives the "We pick up your car" wording on the landing
              page (HowItWorks step 3) and the comparison wedge. When off, the page
              swaps to in-person drop-off copy.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.pickup_offered}
            onClick={() =>
              setState((prev) => ({ ...prev, pickup_offered: !prev.pickup_offered }))
            }
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              state.pickup_offered ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                state.pickup_offered ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* ── Condition card style ──
          Picks how Step 2's overall-condition options render to the
          customer. "Basic" keeps the short hint. "KBB" brings back the
          original Hartecash treatment — Kelley Blue Book–style
          descriptions on each card plus a "View full Kelley Blue Book®
          condition definitions" key dialog. */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-1">
          <ListChecks className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Condition card descriptions</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          How the overall-condition options on Step 2 render. The KBB
          treatment matches the original Hartecash flow with per-card
          KBB descriptions and a tap-to-open Kelley Blue Book® key.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              value: "basic" as const,
              label: "Basic",
              tagline: "Short hint per option",
              body: "One line per card — \"Looks new. No issues.\" / \"Normal wear. Drives perfectly.\" / etc. Fastest read, no pop-ups.",
            },
            {
              value: "kbb" as const,
              label: "Kelley Blue Book® style",
              tagline: "Per-card descriptions + key",
              body: "KBB-style description on each card with the % of vehicles that fall in that bucket, plus a tap-to-open dialog with the full KBB condition definitions. The original Hartecash treatment.",
            },
          ].map((c) => {
            const active = state.condition_card_style === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, condition_card_style: c.value }))
                }
                className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-muted/30 hover:bg-muted hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{c.label}</span>
                  {active && (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {c.tagline}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{c.body}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── CTA button colors ──
          One pair of colors (background + text) drives the landing's
          Get-my-offer button, the wizard's Continue / Get-my-offer
          buttons, AND the offer page Accept slider. Empty = punchy
          yellow #FACC15 background + near-black #0A0A0A text. */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold mb-1">CTA button colors</h3>
            <p className="text-xs text-muted-foreground max-w-prose">
              Drives the color and text on the landing's{" "}
              <strong>Get my offer</strong> button, the wizard's{" "}
              <strong>Continue</strong> / <strong>Get my offer</strong>{" "}
              buttons, and the offer page's <strong>Accept</strong> button.
              Pick a button color first, then if the default near-black
              text doesn't read against it, set a contrasting text color.
            </p>
          </div>
        </div>

        {/* Two color rows side by side on desktop, stacked on mobile.
            Each row: native color picker + hex text input + reset link
            + a swatch preview at the right end. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {([
            {
              key: "landing_cta_color" as const,
              label: "Button color",
              defaultHex: "#FACC15",
              placeholder: "#FACC15",
            },
            {
              key: "landing_cta_text_color" as const,
              label: "Text color",
              defaultHex: "#0A0A0A",
              placeholder: "#0A0A0A",
            },
          ]).map(({ key, label, defaultHex, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={state[key] || defaultHex}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="h-11 w-14 rounded-lg border border-border cursor-pointer p-0.5 flex-shrink-0"
                  aria-label={`${label} picker`}
                />
                <input
                  type="text"
                  value={state[key]}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  className="flex-1 min-w-0 h-11 px-3 rounded-lg border border-border bg-card font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  spellCheck={false}
                />
                {state[key] && (
                  <button
                    type="button"
                    onClick={() =>
                      setState((prev) => ({ ...prev, [key]: "" }))
                    }
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 px-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Live preview pill */}
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between gap-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview
          </div>
          <button
            type="button"
            disabled
            className="h-12 px-6 rounded-xl text-[15px] font-bold inline-flex items-center justify-center gap-2 cursor-default"
            style={{
              background: state.landing_cta_color || "#FACC15",
              color: state.landing_cta_text_color || "#0A0A0A",
              boxShadow:
                "0 4px 12px -2px rgba(0,0,0,0.18), 0 2px 4px -1px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.30)",
            }}
          >
            Get my offer →
          </button>
        </div>
      </section>

      {/* ── Default lookup picker ──
          Which tab opens first on the public landing input cluster
          (Plate & State vs VIN). Some dealer audiences are more
          VIN-literate than plate-literate; this lets the dealer pick. */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold mb-1">Default lookup</h3>
            <p className="text-xs text-muted-foreground max-w-prose">
              Which tab opens first on the landing input cluster. Customers
              can still toggle to the other one — this just sets which
              they see when the page loads.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: "plate", label: "Plate &amp; State", body: "Default for most consumer rooftops. The familiar pattern from Carvana / CarMax." },
            { value: "vin", label: "VIN", body: "Default for luxury, fleet, and out-of-state-heavy audiences who already have the VIN handy." },
          ] as const).map((opt) => {
            const active = state.landing_lookup_default === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setState((prev) => ({ ...prev, landing_lookup_default: opt.value }))
                }
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/15"
                    : "border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="font-bold text-sm"
                    dangerouslySetInnerHTML={{ __html: opt.label }}
                  />
                  {active && (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{opt.body}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Ghost-screen picker ──
          Five premium variants for the BB-lookup transition state.
          Each card renders a live preview so the dealer can see what
          the customer will see while we look up their plate. Copy
          fields default to the component's auto-generated text but
          can be overridden per dealer. */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Ghost Screen</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 max-w-prose">
          Pick the "system is thinking" animation customers see while we look up their car. Five variants — the original Hartecash running-car (default) plus four SaaS-grade transitions.
        </p>

        {/* Unsaved-change banner. Without this, dealers were picking
            a variant, seeing "Selected" / "Active" on the card, and
            assuming it was already live — even though they hadn't
            scrolled down to click Save Changes. The card-level
            "Selected · Save to apply" tag tells you what to do; this
            banner reminds you BEFORE you scroll past. */}
        {state.ghost_screen !== saved.ghost_screen && (
          <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-warning/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-start gap-2">
            <span className="font-bold">⚠ Unsaved change.</span>
            <span>
              You picked{" "}
              <strong>
                {GHOST_OPTIONS.find((o) => o.value === state.ghost_screen)?.label}
              </strong>{" "}
              but the live site is still serving{" "}
              <strong>
                {GHOST_OPTIONS.find((o) => o.value === saved.ghost_screen)?.label}
              </strong>
              . Click <strong>Save Changes</strong> at the bottom to switch.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {GHOST_OPTIONS.map((opt) => {
            // Two distinct states the dealer needs to see:
            //   selected — currently picked in the form (unsaved)
            //   live     — what saved.ghost_screen is set to (the
            //              variant actually serving public traffic)
            // Earlier the badge just said "Active" if state matched,
            // which made dealers think their pick was already live
            // even when they hadn't hit Save Changes. Splitting the
            // labels removes that confusion.
            const selected = state.ghost_screen === opt.value;
            const live = saved.ghost_screen === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, ghost_screen: opt.value }))}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  selected
                    ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                    : live
                    ? "border-success/60 bg-success/5"
                    : "border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40"
                }`}
              >
                {/* Live preview — same component the customer sees */}
                <div className="relative aspect-[16/10] mb-2.5 rounded-md overflow-hidden border border-border/60 bg-background flex items-center justify-center">
                  <GhostScreen kind={opt.value} size="sm" />
                </div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm">{opt.label}</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {opt.recommended && !selected && !live && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                        ★ Default
                      </span>
                    )}
                    {live && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-success bg-success/15 px-2 py-0.5 rounded-full">
                        Live
                      </span>
                    )}
                    {selected && !live && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                        Selected · Save to apply
                      </span>
                    )}
                    {selected && live && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{opt.description}</p>
              </button>
            );
          })}
        </div>

        {/* Copy overrides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Headline (optional)
            </span>
            <Input
              value={state.ghost_headline}
              placeholder='Leave blank for "Looking up your ABC1234…"'
              onChange={(e) =>
                setState((prev) => ({ ...prev, ghost_headline: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Subhead (optional)
            </span>
            <Input
              value={state.ghost_subhead}
              placeholder="Leave blank for the auto-generated registry copy"
              onChange={(e) =>
                setState((prev) => ({ ...prev, ghost_subhead: e.target.value }))
              }
            />
          </label>
        </div>
      </section>

      {/* ── Template picker ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-primary" />
            <h3 className="font-bold">Landing Page Template</h3>
          </div>
          {/* Tile preview-mode toggle. Schematic (default) = the
              hand-drawn SVG thumbnails that load instantly. Live =
              lazy-mounted iframes per tile so the dealer can see
              their actual content + branding rendered. Live can
              chew bandwidth on slow connections, so it's opt-in. */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setTilePreviewMode("schematic")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                tilePreviewMode === "schematic" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              Schematic
            </button>
            <button
              type="button"
              onClick={() => setTilePreviewMode("live")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                tilePreviewMode === "live" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              Live
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          Your / route renders whichever template is selected here. Pick the original Hartecash long-scroll, one of the May-2026 design-audit picks, or any of the 15 alternates.
        </p>

        {/* Live screenshot of the currently-selected template — reads
            from the dealer's actual / route (with ?template= override
            so the preview reflects the unsaved selection too).
            Static thumbnails on the picker tiles still load instantly;
            this iframe is the source of truth for "what does my page
            look like right now." */}
        <LiveTemplatePreview
          template={state.landing_template}
          unsaved={state.landing_template !== saved.landing_template}
        />

        {/* Legacy Hartecash — pre-audit maximalist look, kept featured
            for dealers whose conversions came from the long scroll. */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-micro font-bold uppercase tracking-[0.18em] text-warning">
            ◇ Legacy
          </span>
          <span className="text-[11px] text-muted-foreground italic">— the original Hartecash look</span>
        </div>
        <div className="grid grid-cols-1 gap-3 mb-8">
          {LANDING_TEMPLATES.filter((t) => t.value === "legacy").map((t) => {
            const active = state.landing_template === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, landing_template: t.value }))}
                className={`relative text-left rounded-xl border-2 p-3 transition-all ${
                  active
                    ? "border-warning bg-amber-50 shadow-lg ring-2 ring-amber-300/40"
                    : "border-amber-300/60 bg-card hover:bg-amber-50/40 hover:border-amber-400 shadow-sm"
                }`}
              >
                <div className="aspect-[16/10] mb-2.5 rounded-md overflow-hidden border border-border/60">
                  <LandingTile template={t.value} mode={tilePreviewMode} />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{t.label}</span>
                  {active ? (
                    <span className="text-micro font-bold uppercase tracking-wider text-warning">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-warning bg-amber-100 px-2 py-0.5 rounded-full">
                      ◇ Pick
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>

        {/* Recommended (4 new templates from the design audit) */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-micro font-bold uppercase tracking-[0.18em] text-primary">
            ★ Recommended
          </span>
          <span className="text-[11px] text-muted-foreground italic">— design-audit picks, May 2026</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {LANDING_TEMPLATES.filter((t) => ["moto", "moto_detailed", "clarity", "marquee", "velocity", "heritage"].includes(t.value)).map((t) => {
            const active = state.landing_template === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, landing_template: t.value }))}
                className={`relative text-left rounded-xl border-2 p-3 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                    : "border-primary/30 bg-card hover:bg-muted/50 hover:border-primary/60 shadow-sm"
                }`}
              >
                <div className="aspect-[16/10] mb-2.5 rounded-md overflow-hidden border border-border/60">
                  <LandingTile template={t.value} mode={tilePreviewMode} />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{t.label}</span>
                  {active ? (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                      ★ Pick
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>

        {/* All templates (existing 15) — collapsed under a heading */}
        <details className="border-t border-border pt-5">
          <summary className="cursor-pointer mb-3 text-micro font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-card-foreground transition-colors">
            ▾ All templates (15 more)
          </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {LANDING_TEMPLATES.filter((t) => !["legacy", "moto", "moto_detailed", "clarity", "marquee", "velocity", "heritage"].includes(t.value)).map((t) => {
            const active = state.landing_template === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, landing_template: t.value }))}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-muted/30 hover:bg-muted hover:border-primary/30"
                }`}
              >
                <div className="aspect-[16/10] mb-2.5 rounded-md overflow-hidden border border-border/60">
                  <LandingTile template={t.value} mode={tilePreviewMode} />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{t.label}</span>
                  {active && (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>
        </details>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="shadow-lg"
          size="lg"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
};

/**
 * One picker-tile preview. Two modes:
 *   schematic — the existing hand-drawn SVG (TemplateThumbnail).
 *               Loads instantly, no network.
 *   live      — a real iframe pointing at /?template=<key>&previewMode=1.
 *               Lazy-mounted via IntersectionObserver so 20 tiles
 *               don't all hammer the server on first render. The
 *               iframe renders at native 1280×800 and is scaled to
 *               fit the tile via a ResizeObserver-driven transform
 *               so the WHOLE page is visible (not just the
 *               top-left corner). pointer-events:none on the iframe
 *               + a transparent overlay so clicks bubble up to the
 *               parent button (which selects the template).
 */
const LandingTile = ({
  template,
  mode,
}: {
  template: LandingTemplate;
  mode: "schematic" | "live";
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Scale is computed from the container's actual rendered width
  // so the entire 1280×800 page fits the tile regardless of which
  // grid (1-col legacy, 2-col featured, 3-col alternates) the
  // tile lives in. Default 0.2 covers the first paint before the
  // ResizeObserver fires.
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    if (mode !== "live") return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      // Pre-load tiles slightly outside the viewport so the dealer
      // doesn't see a flicker as they scroll the picker.
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode]);

  // ResizeObserver — keep the scale factor in sync with the actual
  // rendered tile width so the whole 1280×800 page fits regardless
  // of which grid (1-col legacy / 2-col featured / 3-col alternates)
  // and viewport the tile lives in.
  useEffect(() => {
    if (mode !== "live") return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const compute = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScale(w / 1280);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  if (mode === "schematic") {
    return <TemplateThumbnail template={template} />;
  }

  // 1280×800 desktop render — small breakpoints would cascade into
  // mobile layouts on a tiny iframe and stop being recognizable as
  // a desktop template preview.
  const NATIVE_WIDTH = 1280;
  const NATIVE_HEIGHT = 800;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-zinc-50">
      {/* SVG schematic shows during lazy-load + fades out once the
          iframe paints. Sits below the iframe in DOM order so the
          iframe paints over it once mounted. */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      >
        <TemplateThumbnail template={template} />
      </div>
      {visible && (
        <iframe
          src={`/?template=${encodeURIComponent(template)}&previewMode=1`}
          title={`Preview ${template}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => setLoaded(true)}
          style={{
            width: NATIVE_WIDTH,
            height: NATIVE_HEIGHT,
            border: 0,
            // ResizeObserver-driven — fits the entire 1280×800 page
            // into the tile, not just the upper-left corner.
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            background: "#fff",
          }}
        />
      )}
      {/* Tap-shield: keeps clicks on the iframe from being captured
          by the iframe sandbox (belt + suspenders alongside
          pointer-events:none above) so the parent button still
          selects the template. */}
      <div className="absolute inset-0" aria-hidden="true" />
    </div>
  );
};

/**
 * Live preview for the currently-selected landing template.
 *
 * Renders the dealer's actual / route inside an iframe with the
 * picker's selection passed as a ?template= URL override so the
 * preview tracks unsaved changes — flip a tile in the picker and
 * the iframe re-keys to the new template instantly. Two viewport
 * modes (desktop / mobile) since some templates only differ
 * meaningfully at one breakpoint.
 *
 * Uses iframe scaling so a 1280×900 desktop render fits in a
 * ~640×450 admin panel. Auto-resize via the same hartecash-resize
 * postMessage contract EmbedLanding uses, so the preview stays
 * tight to actual content height instead of leaving dead space.
 */
const LiveTemplatePreview = ({
  template,
  unsaved,
}: {
  template: LandingTemplate;
  unsaved: boolean;
}) => {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  // refreshKey lets us hard-remount the iframe on demand. We don't
  // want React reconciliation reusing the iframe across template
  // changes — Lovable's preview iframe caches aggressively, so
  // re-keying is the only reliable way to force a fresh load.
  const [refreshKey, setRefreshKey] = useState(0);

  // ?template= override + cache-buster on every refresh / template
  // change. previewMode=1 lets the page suppress chrome the dealer
  // normally sees but a preview shouldn't (e.g. cookie banners).
  const src = `/?template=${encodeURIComponent(template)}&previewMode=1&_k=${refreshKey}`;

  const openInNewTab = () => window.open(`/?template=${encodeURIComponent(template)}`, "_blank", "noopener");

  // Desktop: 1280px content scaled to fit container at ~50% so the
  // dealer sees the layout the way most of their visitors will.
  // Mobile: native 390px so micro-typography and tap targets read
  // truthfully.
  const frame =
    device === "mobile"
      ? { width: 390, height: 720, scale: 0.7 }
      : { width: 1280, height: 800, scale: 0.5 };

  return (
    <div className="mb-8 rounded-2xl border border-border bg-zinc-50/50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-micro font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Live preview
          </span>
          <span className="text-xs font-semibold text-card-foreground truncate">
            {LANDING_TEMPLATES.find((t) => t.value === template)?.label || template}
          </span>
          {unsaved && (
            <span className="text-micro font-semibold uppercase tracking-[0.16em] text-warning px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={device === "desktop" ? "secondary" : "ghost"}
            onClick={() => setDevice("desktop")}
            className="h-8 px-2.5"
            aria-label="Desktop preview"
          >
            <Monitor className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === "mobile" ? "secondary" : "ghost"}
            onClick={() => setDevice("mobile")}
            className="h-8 px-2.5"
            aria-label="Mobile preview"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="h-8 px-2.5"
            aria-label="Refresh preview"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={openInNewTab}
            className="h-8 px-2.5"
            aria-label="Open in new tab"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,rgba(0,0,0,.04),transparent_60%)]">
        <div
          className="relative bg-white rounded-xl shadow-[0_20px_60px_-30px_rgba(0,0,0,.35)] border border-zinc-200 overflow-hidden"
          style={{
            width: frame.width * frame.scale,
            height: frame.height * frame.scale,
          }}
        >
          <iframe
            key={`${template}-${device}-${refreshKey}`}
            src={src}
            title={`Live preview of ${template}`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{
              width: frame.width,
              height: frame.height,
              border: 0,
              transform: `scale(${frame.scale})`,
              transformOrigin: "top left",
              pointerEvents: "auto",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default LandingFlowConfig;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Layout, Sparkles, Zap, ListChecks } from "lucide-react";
import { LANDING_TEMPLATES, type LandingTemplate } from "@/hooks/useSiteConfig";
import TemplateThumbnail from "@/components/landing/TemplateThumbnail";

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

interface State {
  landing_template: LandingTemplate;
  landing_form_variant: FormVariant;
}

const DEFAULTS: State = {
  landing_template: "classic",
  landing_form_variant: "detailed",
};

const LandingFlowConfig = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();

  const [state, setState] = useState<State>(DEFAULTS);
  const [saved, setSaved] = useState<State>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Ask for both columns first; if landing_form_variant isn't
      // deployed yet on this environment, fall back to template-only
      // so the page still loads instead of bailing out with a generic
      // schema-cache error.
      let row: any = null;
      const wide = await supabase
        .from("site_config" as any)
        .select("landing_template, landing_form_variant")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (wide.error) {
        const lower = wide.error.message?.toLowerCase() || "";
        if (lower.includes("landing_form_variant") || lower.includes("schema cache")) {
          const narrow = await supabase
            .from("site_config" as any)
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
      };
      setState(next);
      setSaved(next);
      setLoading(false);
    })();
  }, [dealershipId]);

  const dirty =
    state.landing_template !== saved.landing_template ||
    state.landing_form_variant !== saved.landing_form_variant;

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
        .from("site_config" as any)
        .update({
          landing_template: state.landing_template,
          updated_at: new Date().toISOString(),
        } as any)
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

    // Pass 2 — variant (best-effort)
    let variantSkipped = false;
    if (variantChanged) {
      const { error: varErr } = await supabase
        .from("site_config" as any)
        .update({
          landing_form_variant: state.landing_form_variant,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("dealership_id", dealershipId);
      if (varErr) {
        const lower = varErr.message?.toLowerCase() || "";
        const code = (varErr as any).code || "";
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
    setSaved({
      ...state,
      ...(variantSkipped ? { landing_form_variant: saved.landing_form_variant } : {}),
    });

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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
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

      {/* ── Template picker ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layout className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Landing Page Template</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Your / route renders whichever template is selected here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANDING_TEMPLATES.map((t) => {
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
                  <TemplateThumbnail template={t.value} />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{t.label}</span>
                  {active && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>
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

export default LandingFlowConfig;

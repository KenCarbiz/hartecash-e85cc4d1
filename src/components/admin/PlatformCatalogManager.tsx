import { useState } from "react";
import { usePlatform } from "@/contexts/PlatformContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Boxes, Package, Sparkles } from "lucide-react";

/**
 * Super-admin-only tool for gating which platform products and
 * bundles show up in the new-subscription flow (onboarding, Billing
 * & Plan picker). Rendered under System Settings → Admin.
 *
 * Toggles the `is_available_for_new_subs` column on each row.
 * Existing subscribers keep access to whatever they're already on —
 * this only controls the marketing surface.
 *
 * Visual: one row per product / bundle with a big lucide icon, the
 * name, a tiny state badge (Visible / Hidden), and a Switch on the
 * right. Matches the app's SiteConfiguration aesthetic (light card,
 * subtle border, tracking-tight titles).
 */
const PlatformCatalogManager = () => {
  const { products, bundles, refreshCatalog } = usePlatform();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (
    table: "platform_products" | "platform_bundles",
    id: string,
    next: boolean,
  ) => {
    setBusy(`${table}:${id}`);
    const { error } = await supabase
      .from(table)
      .update({ is_available_for_new_subs: next })
      .eq("id", id);
    setBusy(null);

    if (error) {
      toast({
        title: "Couldn't update catalog",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await refreshCatalog();
    toast({
      title: next ? "Made available" : "Hidden from new subscribers",
      description:
        "Existing subscriptions are unaffected. New dealers will " +
        (next
          ? "see this option in the Billing & Plan picker."
          : "no longer see this option."),
    });
  };

  // Stable, alphabetical-ish order for the super-admin surface.
  const sortedProducts = [...products].sort((a, b) => a.sort_order - b.sort_order);
  const sortedBundles = [...bundles].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground tracking-tight">
          Platform Catalog
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control which apps and bundles are offered to new dealers. Flipping
          an app off hides it from the onboarding + Billing & Plan picker —
          existing subscribers keep their access.
        </p>
      </div>

      {/* Apps */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Apps</CardTitle>
              <CardDescription className="text-xs">
                Each app can be offered individually or as part of the bundle.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {sortedProducts.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-4">
              No products configured yet.
            </p>
          )}
          {sortedProducts.map((p) => {
            const visible = p.is_available_for_new_subs !== false;
            const key = `platform_products:${p.id}`;
            return (
              <CatalogRow
                key={p.id}
                id={p.id}
                title={p.name}
                subtitle={p.description}
                visible={visible}
                busy={busy === key}
                onToggle={(v) => toggle("platform_products", p.id, v)}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Bundles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Bundles</CardTitle>
              <CardDescription className="text-xs">
                Multi-app plans (All-Apps Unlimited, Enterprise).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {sortedBundles.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-4">
              No bundles configured yet.
            </p>
          )}
          {sortedBundles.map((b) => {
            const visible = b.is_available_for_new_subs !== false;
            const key = `platform_bundles:${b.id}`;
            return (
              <CatalogRow
                key={b.id}
                id={b.id}
                title={b.name}
                subtitle={b.description}
                visible={visible}
                busy={busy === key}
                onToggle={(v) => toggle("platform_bundles", b.id, v)}
                tag={b.is_enterprise ? "Enterprise" : undefined}
              />
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <Boxes className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-snug">
          Changes save instantly. Hiding an app does <span className="font-semibold">not</span>{" "}
          cancel existing subscriptions — it only controls what new dealers see in the
          subscription picker. Use soft-deletion (deactivating in the catalog) for true archival.
        </p>
      </div>
    </div>
  );
};

function CatalogRow({
  id,
  title,
  subtitle,
  visible,
  busy,
  onToggle,
  tag,
}: {
  id: string;
  title: string;
  subtitle: string;
  visible: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
  tag?: string;
}) {
  const switchId = `catalog-toggle-${id}`;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
        visible ? "border-border/60 bg-card" : "border-border/40 bg-muted/20"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Label
            htmlFor={switchId}
            className="text-sm font-semibold text-card-foreground tracking-tight cursor-pointer"
          >
            {title}
          </Label>
          {tag && (
            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider">
              {tag}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-[9px] font-bold uppercase tracking-wider ${
              visible
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {visible ? "Visible" : "Hidden"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
          {subtitle}
        </p>
      </div>
      <div className="shrink-0 mt-0.5">
        <Switch
          id={switchId}
          checked={visible}
          disabled={busy}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
}

export default PlatformCatalogManager;

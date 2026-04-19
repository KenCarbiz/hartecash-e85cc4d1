import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, type Entitlement } from "@/hooks/useEntitlements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Sparkles, ExternalLink, ArrowRight } from "lucide-react";

// App slug display metadata. Kept tiny on purpose — everything else
// (prices, tiers, bundle composition) comes from Stripe.
const APP_LABELS: Record<string, { name: string; blurb: string }> = {
  autocurb: { name: "Autocurb", blurb: "Trade-in funnel + dealer CRM" },
  autolabels: { name: "AutoLabels", blurb: "Window stickers + compliance" },
  autofilm: { name: "AutoFilm", blurb: "Dealer-direct video" },
  autoframe: { name: "AutoFrame", blurb: "Framing + merchandising" },
};
const BUNDLE_SLUG = "autocurb-suite";

type Price = {
  price_id: string;
  product_id: string;
  product_name: string;
  nickname: string | null;
  app_slug: string;
  plan_tier: string;
  includes_apps: string[];
  interval: "month" | "year" | "week" | "day" | null;
  unit_amount: number | null;
  currency: string;
};

type Catalog = { prices: Price[] };

type Interval = "month" | "year";

const formatMoney = (cents: number | null, currency = "usd") => {
  if (cents == null) return "";
  const amount = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

const statusLabel = (s: Entitlement["status"]) => {
  switch (s) {
    case "active":
      return "Active";
    case "trial":
      return "Trial";
    case "past_due":
      return "Past due";
    case "paused":
      return "Paused";
    case "canceled":
      return "Canceled";
    default:
      return s;
  }
};

export default function BillingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();

  const { loading: entLoading, error: entError, tenant, entitlements } =
    useEntitlements();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("month");
  const [pending, setPending] = useState<string | null>(null);

  // URL-driven UX (sister-app handoff + post-checkout banners).
  const welcome = params.get("welcome") === "1";
  const canceled = params.get("canceled") === "1";
  const handoffApp = params.get("app");
  const handoffTier = params.get("tier");
  const handoffReturn = params.get("return");
  const handoffAction = params.get("action");

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke<Catalog>("billing-catalog", { body: {} })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setCatalogError(error.message);
        else if (data) setCatalog(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (welcome) {
      toast({
        title: "Welcome aboard",
        description: "Your subscription is being provisioned. Entitlements will appear within a few seconds.",
      });
    }
    if (canceled) {
      toast({
        title: "Checkout canceled",
        description: "No charges were made. You can pick a plan any time.",
      });
    }
  }, [welcome, canceled, toast]);

  const activeEnts = useMemo(
    () => entitlements.filter((e) => e.status !== "canceled"),
    [entitlements],
  );

  const onBundle = useMemo(
    () => activeEnts.some((e) => e.app_slug === BUNDLE_SLUG),
    [activeEnts],
  );

  const activeAppSlugs = useMemo(
    () => new Set(activeEnts.map((e) => e.app_slug)),
    [activeEnts],
  );

  const pricesByInterval = useMemo(() => {
    if (!catalog) return [];
    return catalog.prices.filter((p) => p.interval === interval);
  }, [catalog, interval]);

  const appPrices = useMemo(() => {
    // Highest-tier per-app price per interval (filter to non-bundle rows).
    // For the UI we pick the "pro" tier if present, else first.
    const byApp = new Map<string, Price[]>();
    for (const p of pricesByInterval) {
      if (p.app_slug === BUNDLE_SLUG) continue;
      const list = byApp.get(p.app_slug) ?? [];
      list.push(p);
      byApp.set(p.app_slug, list);
    }
    const result: Record<string, Price> = {};
    for (const [slug, list] of byApp) {
      const pro = list.find((p) => p.plan_tier === "pro");
      result[slug] = pro ?? list[0];
    }
    return result;
  }, [pricesByInterval]);

  const bundlePrices = useMemo(
    () =>
      pricesByInterval
        .filter((p) => p.app_slug === BUNDLE_SLUG)
        .sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0)),
    [pricesByInterval],
  );
  const recommendedBundle = bundlePrices[0] ?? null;

  // Running total: sum of cheapest-available price per active app (for
  // apps not in a bundle). Used for the "save with Suite" math.
  const runningTotalCents = useMemo(() => {
    if (onBundle) return 0;
    let total = 0;
    for (const slug of activeAppSlugs) {
      const price = appPrices[slug];
      if (price?.unit_amount) total += price.unit_amount;
    }
    return total;
  }, [activeAppSlugs, appPrices, onBundle]);

  const savingsVsBundleCents = useMemo(() => {
    if (onBundle || !recommendedBundle?.unit_amount) return 0;
    return Math.max(0, runningTotalCents - recommendedBundle.unit_amount);
  }, [runningTotalCents, recommendedBundle, onBundle]);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const postCheckout = useCallback(
    async (price: Price) => {
      setPending(price.price_id);
      try {
        const origin = window.location.origin;
        const { data, error } = await supabase.functions.invoke<{ url: string }>(
          "billing-checkout",
          {
            body: {
              line_items: [{ price: price.price_id, quantity: 1 }],
              origin,
              source_app: handoffApp || "autocurb",
            },
          },
        );
        if (error) throw error;
        if (data?.url) window.location.href = data.url;
      } catch (err) {
        toast({
          title: "Checkout failed",
          description: (err as Error).message,
          variant: "destructive",
        });
      } finally {
        setPending(null);
      }
    },
    [handoffApp, toast],
  );

  const postAddApp = useCallback(
    async (price: Price) => {
      setPending(price.price_id);
      try {
        const { data, error } = await supabase.functions.invoke<{ subscription_id: string }>(
          "billing-add-app",
          { body: { price: price.price_id } },
        );
        if (error) {
          // 409 → fall through to Checkout bootstrap.
          if ((error as { context?: { status?: number } }).context?.status === 409) {
            await postCheckout(price);
            return;
          }
          throw error;
        }
        toast({
          title: "Added to your plan",
          description: `${APP_LABELS[price.app_slug]?.name ?? price.app_slug} is being activated.`,
        });
        if (data) {
          // Entitlements update via webhook; soft refresh after a beat.
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err) {
        toast({
          title: "Couldn't add app",
          description: (err as Error).message,
          variant: "destructive",
        });
      } finally {
        setPending(null);
      }
    },
    [postCheckout, toast],
  );

  const postUpgradeToBundle = useCallback(
    async (price: Price) => {
      setPending(price.price_id);
      try {
        const { data, error } = await supabase.functions.invoke<{ subscription_id: string }>(
          "billing-upgrade-to-bundle",
          { body: { bundle_price: price.price_id } },
        );
        if (error) {
          if ((error as { context?: { status?: number } }).context?.status === 409) {
            await postCheckout(price);
            return;
          }
          throw error;
        }
        toast({
          title: "Upgraded to Autocurb Suite",
          description: "All four apps are being activated on your account.",
        });
        if (data) setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        toast({
          title: "Upgrade failed",
          description: (err as Error).message,
          variant: "destructive",
        });
      } finally {
        setPending(null);
      }
    },
    [postCheckout, toast],
  );

  const openPortal = useCallback(async () => {
    setPending("portal");
    try {
      const { data, error } = await supabase.functions.invoke<{ url: string }>(
        "billing-portal-session",
        {
          body: {
            return_url: handoffReturn || `${window.location.origin}/billing`,
          },
        },
      );
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Portal unavailable",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  }, [handoffReturn, toast]);

  const clearHandoff = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("action");
    next.delete("app");
    next.delete("tier");
    next.delete("return");
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Auth gate: bounce unsigned users to login, remembering where they wanted to land.
  useEffect(() => {
    if (!entLoading && entError === "not signed in") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/admin/login?next=${next}`, { replace: true });
    }
  }, [entLoading, entError, navigate]);

  if (entLoading || (!catalog && !catalogError)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entError && entError !== "not signed in") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-2">Billing unavailable</h1>
          <p className="text-muted-foreground">{entError}</p>
        </div>
      </div>
    );
  }

  const currentSummary = (() => {
    if (onBundle) {
      const bundle = activeEnts.find((e) => e.app_slug === BUNDLE_SLUG)!;
      return {
        headline: "Autocurb Suite",
        tier: bundle.plan_tier ?? "",
        status: bundle.status,
        expires: bundle.expires_at,
      };
    }
    if (activeEnts.length === 0) {
      return {
        headline: "No active subscription",
        tier: "",
        status: undefined,
        expires: null,
      };
    }
    return {
      headline: `${activeEnts.length} app${activeEnts.length === 1 ? "" : "s"} active`,
      tier: "",
      status: activeEnts[0].status,
      expires: activeEnts[0].expires_at,
    };
  })();

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="text-muted-foreground">
              {tenant?.name ? `Plan for ${tenant.name}` : "Manage your subscription"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-muted p-0.5">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm rounded ${interval === "month" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setInterval("month")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm rounded ${interval === "year" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setInterval("year")}
              >
                Annual
              </button>
            </div>
          </div>
        </header>

        {handoffAction === "add" && handoffApp && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {APP_LABELS[handoffApp]?.name ?? handoffApp}
                  {handoffTier ? ` — ${handoffTier}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  You arrived from a sister app. Confirm below to add this to your subscription.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearHandoff}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {catalogError && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">
              Couldn't load pricing catalog: {catalogError}
            </CardContent>
          </Card>
        )}

        {/* Current plan */}
        <Card>
          <CardHeader>
            <CardTitle>Your current plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{currentSummary.headline}</span>
              {currentSummary.tier && <Badge variant="secondary">{currentSummary.tier}</Badge>}
              {currentSummary.status && (
                <Badge variant={currentSummary.status === "past_due" ? "destructive" : "outline"}>
                  {statusLabel(currentSummary.status)}
                </Badge>
              )}
            </div>
            {!onBundle && activeEnts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeEnts.map((e) => (
                  <Badge key={e.app_slug} variant="outline">
                    {APP_LABELS[e.app_slug]?.name ?? e.app_slug}
                    {e.plan_tier ? ` · ${e.plan_tier}` : ""}
                  </Badge>
                ))}
              </div>
            )}
            {currentSummary.expires && (
              <p className="text-sm text-muted-foreground">
                Renews {new Date(currentSummary.expires).toLocaleDateString()}
              </p>
            )}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={openPortal}
                disabled={pending === "portal" || !tenant?.stripe_customer_id}
              >
                {pending === "portal" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Manage billing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bundle upsell */}
        {recommendedBundle && !onBundle && (
          <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle>Autocurb Suite</CardTitle>
                <Badge>Recommended</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                All four apps on one subscription. From {formatMoney(recommendedBundle.unit_amount, recommendedBundle.currency)}/{recommendedBundle.interval}.
              </p>
              {savingsVsBundleCents > 0 && (
                <p className="text-sm">
                  You'd save {formatMoney(savingsVsBundleCents, recommendedBundle.currency)}/{recommendedBundle.interval} vs. your current mix.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {bundlePrices.map((p) => (
                  <Button
                    key={p.price_id}
                    onClick={() =>
                      activeEnts.length > 0
                        ? postUpgradeToBundle(p)
                        : postCheckout(p)
                    }
                    disabled={pending === p.price_id}
                  >
                    {pending === p.price_id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {activeEnts.length > 0 ? "Upgrade to" : "Start"}{" "}
                    {p.plan_tier.replace(/^bundle-/, "")} —{" "}
                    {formatMoney(p.unit_amount, p.currency)}/{p.interval}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mix and match */}
        {!onBundle && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Or mix and match</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(APP_LABELS).map(([slug, info]) => {
                const price = appPrices[slug];
                const isActive = activeAppSlugs.has(slug);
                const highlight = handoffApp === slug;
                return (
                  <Card
                    key={slug}
                    className={highlight ? "border-primary ring-2 ring-primary/30" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{info.name}</CardTitle>
                        {isActive && (
                          <Badge variant="secondary">
                            <Check className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{info.blurb}</p>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3">
                      <div>
                        {price ? (
                          <p className="font-medium">
                            {formatMoney(price.unit_amount, price.currency)}
                            <span className="text-muted-foreground">/{price.interval}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not available {interval === "year" ? "annually" : "monthly"}</p>
                        )}
                      </div>
                      {price && !isActive && (
                        <Button
                          size="sm"
                          onClick={() =>
                            activeEnts.length > 0
                              ? postAddApp(price)
                              : postCheckout(price)
                          }
                          disabled={pending === price.price_id}
                        >
                          {pending === price.price_id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4 mr-1" />
                          )}
                          Add
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {activeAppSlugs.size >= 1 && recommendedBundle && savingsVsBundleCents > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Running total: {formatMoney(runningTotalCents, recommendedBundle.currency)}/{recommendedBundle.interval}
                {" · "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => postUpgradeToBundle(recommendedBundle)}
                >
                  save {formatMoney(savingsVsBundleCents, recommendedBundle.currency)}/{recommendedBundle.interval} with Suite →
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

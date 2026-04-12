import { useState } from "react";
import { usePlatform, PlatformBundle } from "@/contexts/PlatformContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Car, FileCheck, Camera, Video, Check, Lock, Sparkles, Crown,
  CreditCard, ArrowRight, Zap,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Car,
  FileCheck,
  Camera,
  Video,
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  trial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  suspended: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const PlatformSubscriptions = () => {
  const { products, bundles, activeProducts, subscription, hasProduct } = usePlatform();
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);

  const currentBundle = bundles.find((b) => b.id === subscription?.bundle_id);

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-card-foreground tracking-tight">Platform & Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your Autocurb Platform subscription and product access.
        </p>
      </div>

      {/* Current Subscription Card */}
      <Card className="border-border/50 shadow-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <CardHeader className="relative pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                <CreditCard className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>
                  {subscription
                    ? `${subscription.billing_cycle === "annual" ? "Annual" : "Monthly"} billing`
                    : "No active subscription"}
                </CardDescription>
              </div>
            </div>
            {subscription && (
              <Badge variant="outline" className={`text-xs font-semibold ${STATUS_COLORS[subscription.status] || ""}`}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative space-y-4">
          {subscription && currentBundle ? (
            <>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                <div>
                  <p className="text-sm font-bold text-card-foreground flex items-center gap-2">
                    {currentBundle.name} Plan
                    {currentBundle.is_featured && (
                      <Badge className="text-[9px] h-4 bg-primary/10 text-primary border-primary/20">Popular</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{currentBundle.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-card-foreground">
                    {formatPrice(subscription.monthly_amount ?? currentBundle.monthly_price)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    per month
                  </p>
                </div>
              </div>

              {/* Active products */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Products</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {products
                    .filter((p) => p.is_active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((product) => {
                      const Icon = ICON_MAP[product.icon_name] || Car;
                      const active = hasProduct(product.id);

                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            active
                              ? "bg-card border-border/50 shadow-sm"
                              : "bg-muted/30 border-transparent opacity-60"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              active
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-card-foreground truncate">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{product.description}</p>
                          </div>
                          {active ? (
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {subscription.trial_ends_at && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                  <strong>Trial period:</strong> Ends{" "}
                  {new Date(subscription.trial_ends_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Zap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-card-foreground">No Active Subscription</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a plan below to get started with the Autocurb Platform.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bundle Comparison */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-bold text-card-foreground">Compare Plans</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bundles
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((bundle) => {
              const isCurrent = subscription?.bundle_id === bundle.id;
              const isSelected = selectedBundle === bundle.id;

              return (
                <Card
                  key={bundle.id}
                  className={`relative overflow-hidden transition-all duration-200 cursor-pointer ${
                    isCurrent
                      ? "border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                      : isSelected
                        ? "border-primary/30 shadow-md"
                        : "border-border/50 hover:border-border hover:shadow-md"
                  }`}
                  onClick={() => !isCurrent && setSelectedBundle(isSelected ? null : bundle.id)}
                >
                  {bundle.is_featured && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
                      Most Popular
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
                      Current Plan
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{bundle.name}</CardTitle>
                    <CardDescription className="text-xs">{bundle.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold text-card-foreground">
                        {formatPrice(bundle.monthly_price)}
                        <span className="text-xs font-normal text-muted-foreground">/mo</span>
                      </p>
                      {bundle.annual_price && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          or {formatPrice(bundle.annual_price)}/yr (save{" "}
                          {Math.round((1 - bundle.annual_price / (bundle.monthly_price * 12)) * 100)}%)
                        </p>
                      )}
                    </div>

                    {/* Feature list */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      {products
                        .filter((p) => p.is_active)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((product) => {
                          const included = bundle.product_ids.includes(product.id);
                          const Icon = ICON_MAP[product.icon_name] || Car;

                          return (
                            <div
                              key={product.id}
                              className={`flex items-center gap-2 text-xs ${
                                included ? "text-card-foreground" : "text-muted-foreground/40 line-through"
                              }`}
                            >
                              {included ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Lock className="w-3 h-3 shrink-0" />
                              )}
                              <Icon className="w-3 h-3 shrink-0" />
                              <span>{product.name}</span>
                            </div>
                          );
                        })}

                      {/* Enterprise extras */}
                      {bundle.id === "enterprise" && (
                        <>
                          <div className="flex items-center gap-2 text-xs text-card-foreground">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>DMS Integration</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-card-foreground">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>Priority Support</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action */}
                    {isCurrent ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBundle(isSelected ? null : bundle.id);
                        }}
                      >
                        {isSelected ? (
                          <>
                            Selected <Check className="w-3.5 h-3.5 ml-1.5" />
                          </>
                        ) : (
                          <>
                            Select Plan <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Change Plan CTA */}
        {selectedBundle && selectedBundle !== subscription?.bundle_id && (
          <Card className="border-primary/30 bg-primary/[0.03]">
            <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-card-foreground">
                  Switch to {bundles.find((b) => b.id === selectedBundle)?.name} Plan?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Payment processing via Stripe is coming soon. This selection will be saved for when billing goes live.
                </p>
              </div>
              <Button size="sm" className="shrink-0 px-6">
                <CreditCard className="w-4 h-4 mr-2" />
                Confirm Change
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PlatformSubscriptions;

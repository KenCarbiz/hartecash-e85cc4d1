import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Zap,
  Car,
  Loader2,
  DollarSign,
  Phone,
  User,
  Wrench,
  CheckCircle2,
  ArrowRight,
  QrCode,
  Send,
  RefreshCw,
  AlertCircle,
  Gauge,
  Flame,
  Snowflake,
  ThermometerSun,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { calculateEquity } from "@/lib/equityCalculator";
import SEO from "@/components/SEO";

type VehicleInfo = {
  year: string;
  make: string;
  model: string;
  trim?: string;
};

type BBValues = {
  retail_avg: number | null;
  wholesale_avg: number | null;
  tradein_avg: number | null;
};

type Stage = "entry" | "lookup-done" | "success";

const ALLOWED_ROLES = ["admin", "sales_bdc", "used_car_manager", "new_car_manager", "gsm_gm"];

const ServiceQuickEntry = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { config: siteConfig } = useSiteConfig();

  // Auth / staff state
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  // Form state
  const [stage, setStage] = useState<Stage>("entry");
  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loanPayoff, setLoanPayoff] = useState("");
  const [serviceReason, setServiceReason] = useState("");

  // Lookup results
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [bbValues, setBbValues] = useState<BBValues>({
    retail_avg: null,
    wholesale_avg: null,
    tradein_avg: null,
  });

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string>("");

  // ── Auth guard ──
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      if (!roleData || !ALLOWED_ROLES.includes(roleData.role)) {
        toast({
          title: "Access denied",
          description: "You don't have permission to use Service Quick Entry.",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }
      setUserRole(roleData.role);
      setUserEmail(session.user.email || "");
      setAuthChecked(true);
    };
    checkAuth();
  }, [navigate, toast]);

  // ── Derived values ──
  const estimatedOffer = useMemo(() => {
    // Simple estimate: midpoint between tradein and wholesale
    const t = bbValues.tradein_avg ?? 0;
    const w = bbValues.wholesale_avg ?? 0;
    if (t === 0 && w === 0) return 0;
    if (w === 0) return t;
    if (t === 0) return w;
    return Math.round((t + w) / 2);
  }, [bbValues]);

  const equityResult = useMemo(() => {
    if (!estimatedOffer) return null;
    const payoffNum = loanPayoff ? Number(loanPayoff.replace(/[^0-9.]/g, "")) : null;
    if (payoffNum === null || Number.isNaN(payoffNum)) return null;
    return calculateEquity(estimatedOffer, payoffNum);
  }, [estimatedOffer, loanPayoff]);

  // ── Handlers ──
  const handleLookup = async () => {
    const trimmedVin = vin.trim().toUpperCase();
    if (trimmedVin.length !== 17) {
      setLookupError("VIN must be exactly 17 characters.");
      return;
    }
    if (!mileage.trim()) {
      setLookupError("Please enter current mileage.");
      return;
    }
    setLookupError("");
    setLookupLoading(true);
    setVehicle(null);
    setBbValues({ retail_avg: null, wholesale_avg: null, tradein_avg: null });
    try {
      const { data, error } = await supabase.functions.invoke("bb-lookup", {
        body: {
          lookup_type: "vin",
          vin: trimmedVin,
          state: "CT",
          mileage: Number(mileage.replace(/[^0-9]/g, "")) || undefined,
        },
      });
      if (error || data?.error || !data?.vehicles?.length) {
        setLookupError("Could not decode this VIN. Please check and try again.");
        setLookupLoading(false);
        return;
      }
      const v = data.vehicles[0];
      setVehicle({
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.series || v.style || "",
      });
      setBbValues({
        retail_avg: v.retail?.avg ?? null,
        wholesale_avg: v.wholesale?.avg ?? null,
        tradein_avg: v.tradein?.avg ?? null,
      });
      setVin(trimmedVin);
      setStage("lookup-done");
    } catch (err) {
      setLookupError("Lookup failed. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateOpportunity = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast({
        title: "Missing information",
        description: "First name, last name, and phone are required.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const payoffNum = loanPayoff
        ? Number(loanPayoff.replace(/[^0-9.]/g, ""))
        : null;

      const insertPayload: Record<string, any> = {
        token: generatedToken,
        vin: vin || null,
        mileage: mileage || null,
        vehicle_year: vehicle?.year || null,
        vehicle_make: vehicle?.make || null,
        vehicle_model: vehicle?.model || null,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone || null,
        bb_tradein_avg: bbValues.tradein_avg,
        bb_wholesale_avg: bbValues.wholesale_avg,
        bb_retail_avg: bbValues.retail_avg,
        estimated_offer_high: estimatedOffer || null,
        lead_source: "service",
        progress_status: "new",
        next_step: "service_trade",
        dealership_id: tenant.dealership_id,
        assigned_rep_email: userEmail || null,
        internal_notes: serviceReason
          ? `Service reason: ${serviceReason}\nCreated via Service Quick Entry by ${userEmail}`
          : `Created via Service Quick Entry by ${userEmail}`,
      };

      if (payoffNum !== null && !Number.isNaN(payoffNum)) {
        insertPayload.loan_payoff_amount = payoffNum;
        insertPayload.loan_payoff_verified = true;
        insertPayload.loan_payoff_updated_at = new Date().toISOString();
        if (estimatedOffer) {
          insertPayload.estimated_equity = estimatedOffer - payoffNum;
        }
      }

      const { error } = await supabase
        .from("submissions")
        .insert(insertPayload as any);
      if (error) throw error;

      // Fire staff notification (best-effort)
      const { data: insertedSub } = await supabase
        .from("submissions")
        .select("id")
        .eq("token", generatedToken)
        .maybeSingle();
      if (insertedSub) {
        safeInvoke("send-notification", {
          body: { trigger_key: "new_submission", submission_id: insertedSub.id },
          context: { from: "ServiceQuickEntry.submit" },
        });
      }

      setCreatedToken(generatedToken);
      setStage("success");
      toast({
        title: "Opportunity created",
        description: "Lead captured successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Could not create opportunity",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStage("entry");
    setVin("");
    setMileage("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setLoanPayoff("");
    setServiceReason("");
    setVehicle(null);
    setBbValues({ retail_avg: null, wholesale_avg: null, tradein_avg: null });
    setLookupError("");
    setCreatedToken("");
  };

  const sendCustomerLink = async (method: "sms" | "email") => {
    if (!createdToken) return;
    const link = `${window.location.origin}/my-submission/${createdToken}`;
    try {
      if (method === "sms") {
        // Try native share / fallback to clipboard
        if (navigator.share) {
          await navigator.share({
            title: "Your Trade-In Offer",
            text: `View your trade offer: ${link}`,
            url: link,
          });
        } else {
          await navigator.clipboard.writeText(link);
          toast({
            title: "Link copied",
            description: "Paste it into a text to the customer.",
          });
        }
      } else {
        await navigator.clipboard.writeText(link);
        toast({
          title: "Link copied",
          description: "Paste it into an email to the customer.",
        });
      }
    } catch {
      toast({
        title: "Could not share",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  // ── Render guards ──
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const customerLink = createdToken
    ? `${window.location.origin}/my-submission/${createdToken}`
    : "";

  // ── Success screen ──
  if (stage === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <SEO title="Opportunity Created" />
        <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Opportunity Created</h1>
              <p className="text-xs text-muted-foreground">
                Lead captured for {firstName} {lastName}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-8 shadow-xl text-center">
            <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {firstName}'s lead is live
            </h2>
            {vehicle && (
              <p className="text-muted-foreground text-base">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            )}
            {estimatedOffer > 0 && (
              <p className="text-3xl font-bold text-primary mt-3">
                Est. ${estimatedOffer.toLocaleString()}
              </p>
            )}
          </div>

          {/* Approach customer — QR code */}
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Approach Customer Now
                </h3>
                <p className="text-xs text-muted-foreground">
                  Have them scan this QR to take over on their phone
                </p>
              </div>
            </div>
            <div className="flex justify-center bg-white rounded-2xl p-5 border border-border/30">
              <QRCodeSVG value={customerLink} size={220} level="M" includeMargin />
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground break-all">
              {customerLink}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => sendCustomerLink("sms")}
              className="h-14 text-base font-semibold"
              variant="outline"
            >
              <Phone className="w-5 h-5 mr-2" />
              Send via SMS
            </Button>
            <Button
              onClick={() => sendCustomerLink("email")}
              className="h-14 text-base font-semibold"
              variant="outline"
            >
              <Send className="w-5 h-5 mr-2" />
              Send via Email
            </Button>
          </div>

          <Button
            onClick={resetForm}
            className="w-full h-14 text-base font-semibold"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Enter Another Lead
          </Button>

          <div className="pt-2 text-center">
            <button
              onClick={() => navigate("/admin")}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Back to Admin Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Entry / lookup-done screen ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEO title="Service Quick Entry" />

      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                Service Quick Entry
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {(siteConfig as any)?.site_title || tenant.display_name} · {userEmail}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="shrink-0"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exit</span>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Vehicle Lookup Card */}
        <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Vehicle</h2>
              <p className="text-xs text-muted-foreground">
                Enter VIN and mileage to look up values
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="vin" className="text-sm font-semibold mb-2 block">
                VIN
              </Label>
              <Input
                id="vin"
                value={vin}
                onChange={(e) =>
                  setVin(e.target.value.toUpperCase().slice(0, 17))
                }
                placeholder="17-character VIN"
                maxLength={17}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="h-14 text-lg font-mono tracking-wider"
                disabled={lookupLoading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {vin.length}/17
              </p>
            </div>

            <div>
              <Label htmlFor="mileage" className="text-sm font-semibold mb-2 block">
                Current Mileage
              </Label>
              <div className="relative">
                <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="mileage"
                  type="tel"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) =>
                    setMileage(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="e.g. 48,500"
                  className="h-14 text-lg pl-12"
                  disabled={lookupLoading}
                />
              </div>
            </div>

            {lookupError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}

            <Button
              onClick={handleLookup}
              disabled={lookupLoading || vin.length !== 17 || !mileage}
              className="w-full h-14 text-base font-bold"
              size="lg"
            >
              {lookupLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Looking up vehicle...
                </>
              ) : (
                <>
                  <Car className="w-5 h-5 mr-2" />
                  {stage === "lookup-done" ? "Re-run Lookup" : "Look Up Vehicle"}
                </>
              )}
            </Button>
          </div>

          {/* Vehicle Result */}
          {stage === "lookup-done" && vehicle && (
            <div className="mt-6 pt-6 border-t border-border/40 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Decoded
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  {vehicle.trim && (
                    <p className="text-sm text-muted-foreground">{vehicle.trim}</p>
                  )}
                </div>
                <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <ValueTile
                  label="Retail"
                  value={bbValues.retail_avg}
                  tone="muted"
                />
                <ValueTile
                  label="Wholesale"
                  value={bbValues.wholesale_avg}
                  tone="muted"
                />
                <ValueTile
                  label="Trade-In"
                  value={bbValues.tradein_avg}
                  tone="muted"
                />
              </div>

              {estimatedOffer > 0 && (
                <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    Estimated Offer
                  </p>
                  <p className="text-3xl font-extrabold text-primary">
                    ${estimatedOffer.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Customer + Loan Card — only shown after lookup */}
        {stage === "lookup-done" && (
          <>
            <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Customer</h2>
                  <p className="text-xs text-muted-foreground">
                    Capture contact details while they wait
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-semibold mb-2 block">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="h-14 text-base"
                      autoCapitalize="words"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-semibold mb-2 block">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="h-14 text-base"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-semibold mb-2 block">
                    Customer Phone
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="h-14 text-lg pl-12"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="payoff" className="text-sm font-semibold mb-2 block">
                    Loan Payoff Amount{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="payoff"
                      type="tel"
                      inputMode="decimal"
                      value={loanPayoff}
                      onChange={(e) =>
                        setLoanPayoff(e.target.value.replace(/[^0-9.]/g, ""))
                      }
                      placeholder="0"
                      className="h-14 text-lg pl-12"
                    />
                  </div>
                </div>

                {equityResult && (
                  <EquityBanner result={equityResult} />
                )}

                <div>
                  <Label htmlFor="reason" className="text-sm font-semibold mb-2 block">
                    Service Reason{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <div className="relative">
                    <Wrench className="absolute left-4 top-4 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Textarea
                      id="reason"
                      value={serviceReason}
                      onChange={(e) => setServiceReason(e.target.value)}
                      placeholder="Oil change, brake job, etc."
                      className="min-h-24 text-base pl-12 pt-4"
                    />
                  </div>
                </div>
              </div>
            </section>

            <Button
              onClick={handleCreateOpportunity}
              disabled={submitting}
              className="w-full h-16 text-lg font-bold shadow-lg"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Creating opportunity...
                </>
              ) : (
                <>
                  Create Opportunity
                  <ArrowRight className="w-6 h-6 ml-2" />
                </>
              )}
            </Button>
          </>
        )}
      </main>
    </div>
  );
};

// ── Small presentational helpers ──

const ValueTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "primary" | "muted";
}) => (
  <div
    className={`rounded-2xl border p-3 text-center ${
      tone === "primary"
        ? "bg-primary/10 border-primary/30"
        : "bg-muted/40 border-border/40"
    }`}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
      {label}
    </p>
    <p
      className={`text-base font-bold ${
        tone === "primary" ? "text-primary" : "text-foreground"
      }`}
    >
      {value ? `$${Math.round(value).toLocaleString()}` : "—"}
    </p>
  </div>
);

const EquityBanner = ({
  result,
}: {
  result: ReturnType<typeof calculateEquity>;
}) => {
  const toneMap = {
    hot: {
      bg: "bg-success/10 border-success/40",
      text: "text-success",
      Icon: Flame,
      label: "HOT EQUITY",
    },
    warm: {
      bg: "bg-amber-500/10 border-amber-500/40",
      text: "text-amber-600 dark:text-amber-400",
      Icon: ThermometerSun,
      label: "WARM EQUITY",
    },
    cold: {
      bg: "bg-muted/40 border-border/40",
      text: "text-muted-foreground",
      Icon: Snowflake,
      label: "LOW EQUITY",
    },
    negative: {
      bg: "bg-destructive/10 border-destructive/40",
      text: "text-destructive",
      Icon: AlertCircle,
      label: "UNDERWATER",
    },
  } as const;
  const tone = toneMap[result.label];
  const Icon = tone.Icon;
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${tone.bg}`}>
      <div className={`w-10 h-10 rounded-xl bg-background/60 flex items-center justify-center ${tone.text}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${tone.text}`}>
          {tone.label}
        </p>
        <p className={`text-xl font-extrabold ${tone.text}`}>
          {result.displayText}
        </p>
      </div>
    </div>
  );
};

export default ServiceQuickEntry;

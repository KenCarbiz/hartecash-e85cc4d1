import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Save, CheckCircle2, Loader2, QrCode, Link2, X, Smartphone, Sparkles, Globe, ChevronDown, ChevronRight, Rocket, ExternalLink } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SignaturePad from "./SignaturePad";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { ONBOARDING_SECTIONS, sectionProgress, getSmartDefaults } from "@/lib/onboardingSections";
import type { Section, QuestionItem } from "@/lib/onboardingSections";
import { applyOnboardingAnswers } from "@/lib/applyOnboardingAnswers";

type Answers = Record<string, string>;

interface OnboardingScriptProps {
  targetDealershipId?: string | null;
  onNavigate?: (section: string) => void;
}

export default function OnboardingScript({ targetDealershipId, onNavigate }: OnboardingScriptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { config } = useSiteConfig();
  const [answers, setAnswers] = useState<Answers>({});
  const [dealerSig, setDealerSig] = useState<string | null>(null);
  const [staffSig, setStaffSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const sections = ONBOARDING_SECTIONS;

  // Count filled answers (exclude link-type questions)
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.filter(q => q.type !== "link").length, 0);
  const filledCount = Object.values(answers).filter((v) => v && v.trim() !== "").length;
  const progressPct = Math.round((filledCount / totalQuestions) * 100);

  // Load existing data
  useEffect(() => {
    const load = async () => {
      const activeDealershipId = targetDealershipId || "default";
      const { data } = await supabase
        .from("dealer_accounts")
        .select("onboarding_answers, onboarding_signature_dealer, onboarding_signature_staff, onboarding_signed_at")
        .eq("dealership_id", activeDealershipId)
        .maybeSingle();
      if (data) {
        if (data.onboarding_answers && typeof data.onboarding_answers === "object") {
          setAnswers(data.onboarding_answers as Answers);
        }
        setDealerSig(data.onboarding_signature_dealer);
        setStaffSig(data.onboarding_signature_staff);
        if (data.onboarding_signed_at) {
          setSavedAt(new Date(data.onboarding_signed_at).toLocaleString());
        }
      }
      setLoading(false);
    };
    load();
  }, [targetDealershipId]);

  const updateAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      // Smart defaults: when architecture changes, pre-fill routing answers
      if (id === "architecture") {
        const defaults = getSmartDefaults(value);
        for (const [k, v] of Object.entries(defaults)) {
          if (!next[k]?.trim()) next[k] = v;
        }
      }
      return next;
    });
    setDirty(true);
  }, []);

  const toggleChoice = useCallback((id: string, choice: string) => {
    setAnswers((prev) => {
      const current = prev[id] || "";
      const next = { ...prev, [id]: current === choice ? "" : choice };
      if (id === "architecture" && current !== choice) {
        const defaults = getSmartDefaults(choice);
        for (const [k, v] of Object.entries(defaults)) {
          if (!next[k]?.trim()) next[k] = v;
        }
      }
      return next;
    });
    setDirty(true);
  }, []);

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(sections.map(s => s.title)));
  const collapseAll = () => setOpenSections(new Set());

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {
      toast.error("Enter a dealer website URL first");
      return;
    }
    setScraping(true);
    toast.info("Scanning dealer website… this may take 15-30 seconds");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-dealer-site", {
        body: { url: scrapeUrl.trim() },
      });
      if (error) throw error;
      if (!data?.success || !data?.data) {
        toast.error(data?.error || "Failed to extract dealer info");
        setScraping(false);
        return;
      }

      const d = data.data;
      const fieldMap: Record<string, string | undefined> = {
        dealership_name: d.dealership_name,
        tagline: d.tagline,
        phone: d.phone,
        email: d.email,
        address: d.address,
        website: d.website || scrapeUrl.trim(),
        google_review: d.google_review,
        facebook: d.facebook,
        instagram: d.instagram,
        tiktok: d.tiktok,
        youtube: d.youtube,
        primary_color: d.primary_color,
        accent_color: d.accent_color,
        architecture: d.architecture,
      };

      // Map locations to dynamic format
      if (d.locations && Array.isArray(d.locations) && d.locations.length > 0) {
        const locLines = d.locations.map((loc: any) => {
          const parts = [loc.name || "", loc.address || "", loc.city_state_zip || "", loc.brands || ""];
          return parts.join(" | ");
        });
        fieldMap["locations_dynamic"] = locLines.join("\n");
      }

      if (d.business_hours && Array.isArray(d.business_hours)) {
        const hoursStr = d.business_hours.map((h: any) => `${h.days}: ${h.hours}`).join("\n");
        if (hoursStr) fieldMap["business_hours_summary"] = hoursStr;
      }

      let filled = 0;
      setAnswers((prev) => {
        const next = { ...prev };
        for (const [key, val] of Object.entries(fieldMap)) {
          if (val && val.trim() && !next[key]?.trim()) {
            next[key] = val;
            filled++;
          }
        }
        return next;
      });

      setDirty(true);
      toast.success(`Auto-filled ${filled} fields from ${d.dealership_name || "website"}`);
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast.error("Failed to scrape website: " + (err.message || "Unknown error"));
    }
    setScraping(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const activeDealershipId = targetDealershipId || "default";
    const { error } = await supabase
      .from("dealer_accounts")
      .update({
        onboarding_answers: answers,
        onboarding_signature_dealer: dealerSig,
        onboarding_signature_staff: staffSig,
        onboarding_signed_at: dealerSig || staffSig ? new Date().toISOString() : null,
      } as any)
      .eq("dealership_id", activeDealershipId);

    if (error) {
      toast.error("Failed to save — " + error.message);
    } else {
      setSavedAt(new Date().toLocaleString());
      setDirty(false);
      toast.success("Onboarding questionnaire saved");
    }
    setSaving(false);
  };

  const handleApplyAll = async () => {
    setApplying(true);
    const dealershipId = targetDealershipId || "default";
    try {
      const { applied, errors } = await applyOnboardingAnswers(answers, dealershipId);
      if (applied.length > 0) {
        toast.success(`Applied: ${applied.join(", ")}`);
      }
      if (errors.length > 0) {
        toast.error(`Errors: ${errors.join(", ")}`);
      }
      if (applied.length === 0 && errors.length === 0) {
        toast.info("No answers to apply yet — fill out the questionnaire first.");
      }
    } catch (err: any) {
      toast.error("Apply failed: " + err.message);
    }
    setApplying(false);
  };

  const handlePrint = () => window.print();

  const [showQR, setShowQR] = useState(false);
  const mobileUrl = `${window.location.origin}/onboard/${targetDealershipId || "default"}`;

  const copyLink = () => {
    navigator.clipboard.writeText(mobileUrl);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderQuestion = (q: QuestionItem) => {
    if (q.type === "link") {
      return (
        <button
          type="button"
          onClick={() => q.linkTarget && onNavigate?.(q.linkTarget)}
          className="flex items-center gap-2 text-xs text-primary hover:underline font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open {q.label.split(" are managed")[0] || "Settings"}
        </button>
      );
    }

    if (q.type === "text") {
      return (
        <>
          <Input
            className="h-8 text-sm print:hidden"
            placeholder="—"
            value={answers[q.id] || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            maxLength={500}
          />
          <div className="hidden print:block">
            {answers[q.id] ? (
              <p className="text-sm border-b border-muted-foreground/30 pb-1 min-h-[1.5rem]">{answers[q.id]}</p>
            ) : (
              <div className="border-b-2 border-dashed border-muted-foreground/30 h-6" />
            )}
          </div>
        </>
      );
    }

    if (q.type === "multiline") {
      return (
        <>
          <Textarea
            className="text-sm min-h-[60px] print:hidden"
            placeholder="—"
            value={answers[q.id] || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            maxLength={2000}
          />
          <div className="hidden print:block">
            {answers[q.id] ? (
              <p className="text-sm whitespace-pre-line border-b border-muted-foreground/30 pb-1">{answers[q.id]}</p>
            ) : (
              <div className="space-y-2">
                <div className="border-b-2 border-dashed border-muted-foreground/30 h-5" />
                <div className="border-b-2 border-dashed border-muted-foreground/30 h-5" />
              </div>
            )}
          </div>
        </>
      );
    }

    if (q.type === "check") {
      return (
        <div className="flex items-center gap-3 h-8">
          <button type="button" onClick={() => toggleChoice(q.id, "yes")}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${answers[q.id] === "yes" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            Yes
          </button>
          <button type="button" onClick={() => toggleChoice(q.id, "no")}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${answers[q.id] === "no" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:bg-muted"}`}>
            No
          </button>
        </div>
      );
    }

    if (q.type === "choice" && q.choices) {
      // Acquisition intent slider
      if (q.id === "acquisition_intent") {
        return (
          <div className="w-full space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>🟢 Conservative</span>
              <span>🔴 Predator</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, hsl(var(--chart-2)), hsl(var(--chart-4)), hsl(var(--destructive)))" }}>
              {(() => {
                const idx = q.choices!.indexOf(answers[q.id] || "");
                if (idx < 0) return null;
                const pct = (idx / (q.choices!.length - 1)) * 100;
                return <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background border-2 border-foreground shadow-md transition-all" style={{ left: `calc(${pct}% - 8px)` }} />;
              })()}
            </div>
            <div className="flex justify-between gap-1">
              {q.choices.map((c) => (
                <button key={c} type="button" onClick={() => toggleChoice(q.id, c)}
                  className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors text-center ${answers[q.id] === c ? "bg-primary text-primary-foreground border-primary font-bold" : "border-border hover:bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-wrap gap-1.5">
          {q.choices.map((c) => (
            <button key={c} type="button" onClick={() => toggleChoice(q.id, c)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${answers[q.id] === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
              {c}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-4xl">
      {/* Screen-only header */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">Onboarding Questionnaire</h2>
          <p className="text-sm text-muted-foreground">
            Complete on screen, go mobile, or send a link to the dealer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setShowQR(!showQR)} size="sm" variant="outline" className="gap-2">
            {showQR ? <X className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            {showQR ? "Close" : "Mobile"}
          </Button>
          <Button onClick={copyLink} size="sm" variant="outline" className="gap-2">
            <Link2 className="w-4 h-4" />
            Copy Link
          </Button>
          <Button onClick={handlePrint} size="sm" variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button onClick={handleSave} size="sm" disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save All"}
          </Button>
        </div>
      </div>

      {/* QR Code + Link Panel */}
      {showQR && (
        <div className="mb-6 border rounded-lg p-6 bg-card print:hidden">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="bg-background p-4 rounded-lg border">
              <QRCodeSVG value={mobileUrl} size={160} />
            </div>
            <div className="flex-1 space-y-3 text-center md:text-left">
              <h3 className="font-semibold flex items-center gap-2 justify-center md:justify-start">
                <QrCode className="w-4 h-4" />
                Go Mobile or Send to Dealer
              </h3>
              <p className="text-sm text-muted-foreground">
                <strong>In-person:</strong> Scan this QR code with your phone or tablet to fill out and sign on the spot.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Remote:</strong> Copy the link and send it to the dealer via email or text — they complete it on their own device.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={mobileUrl}
                  className="text-xs h-8 bg-muted font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button onClick={copyLink} size="sm" variant="secondary" className="shrink-0 gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Auto-Fill Panel */}
      <div className="mb-6 border rounded-lg p-5 bg-gradient-to-r from-primary/5 to-accent/5 print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">AI Auto-Fill from Dealer Website</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Enter the dealer's website URL and we'll automatically pull their name, phone, address, colors, social links, locations, and more.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="e.g. smithmotors.com"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              className="pl-9 h-9"
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            />
          </div>
          <Button onClick={handleScrape} size="sm" disabled={scraping} className="gap-2 shrink-0">
            {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {scraping ? "Scanning…" : "Scrape & Auto-Fill"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 print:hidden">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{filledCount} of {totalQuestions} questions answered</span>
          <div className="flex items-center gap-3">
            <span>{progressPct}%</span>
            <button onClick={expandAll} className="text-primary hover:underline text-[11px]">Expand All</button>
            <button onClick={collapseAll} className="text-primary hover:underline text-[11px]">Collapse All</button>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        {savedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            Last saved: {savedAt}
            {dirty && <span className="text-destructive ml-2">• Unsaved changes</span>}
          </div>
        )}
      </div>

      {/* Apply All Button */}
      <div className="mb-6 print:hidden">
        <Button onClick={handleApplyAll} disabled={applying} variant="outline" className="w-full gap-2 border-primary/30 hover:bg-primary/5">
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4 text-primary" />}
          {applying ? "Applying to all config tables…" : "Apply All Answers → Config Tables"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
          Writes answers to Site Config, Form Config, Notifications, Inspection, and Locations. Save first!
        </p>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="space-y-3 print:space-y-4">
        {/* Print header */}
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-2xl font-bold">{config.dealership_name || "Dealer"} — Onboarding Script</h1>
          <p className="text-sm text-muted-foreground">
            Date: {new Date().toLocaleDateString()} &nbsp;&nbsp; Progress: {filledCount}/{totalQuestions}
          </p>
        </div>

        {sections.map((section) => {
          const { filled, total } = sectionProgress(section, answers);
          const isComplete = filled === total && total > 0;
          const isOpen = openSections.has(section.title);

          return (
            <div key={section.title} className="border rounded-lg overflow-hidden print:break-inside-avoid">
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors print:pointer-events-none",
                  isOpen ? "bg-muted/50 border-b" : "bg-muted/30 hover:bg-muted/50"
                )}
              >
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>{section.icon}</span>
                  {section.title}
                  {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </h3>
                <div className="flex items-center gap-2 print:hidden">
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    isComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {filled}/{total}
                  </span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Accordion content */}
              {(isOpen || typeof window !== "undefined" && window.matchMedia?.("print")?.matches) && (
                <div className={cn("divide-y", !isOpen && "hidden print:block")}>
                  {section.questions.map((q) => (
                    <div key={q.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{q.label}</p>
                        {q.hint && <p className="text-xs text-muted-foreground mt-0.5">{q.hint}</p>}
                      </div>
                      <div className="shrink-0 w-64">
                        {renderQuestion(q)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Digital Signature Block */}
        <div className="border rounded-lg p-6 print:break-inside-avoid print:mt-8">
          <h3 className="text-sm font-bold mb-1">Sign-Off</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Both parties sign below to confirm the onboarding configuration is agreed upon.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="hidden print:block">
              <p className="text-xs text-muted-foreground mb-16">Dealer Representative</p>
              <div className="border-b-2 border-muted-foreground/30 mb-1" />
              <p className="text-xs text-muted-foreground">Signature & Date</p>
            </div>
            <div className="hidden print:block">
              <p className="text-xs text-muted-foreground mb-16">Onboarding Specialist</p>
              <div className="border-b-2 border-muted-foreground/30 mb-1" />
              <p className="text-xs text-muted-foreground">Signature & Date</p>
            </div>

            <div className="print:hidden">
              <SignaturePad label="Dealer Representative" value={dealerSig} onChange={(v) => { setDealerSig(v); setDirty(true); }} />
            </div>
            <div className="print:hidden">
              <SignaturePad label="Onboarding Specialist" value={staffSig} onChange={(v) => { setStaffSig(v); setDirty(true); }} />
            </div>
          </div>

          <div className="mt-4 print:hidden flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save All"}
            </Button>
            <Button onClick={handleApplyAll} disabled={applying} variant="outline" className="gap-2">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Apply to Config
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

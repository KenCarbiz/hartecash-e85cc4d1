import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Save, CheckCircle2, Loader2, QrCode, Link2, X, Smartphone } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SignaturePad from "./SignaturePad";
import { QRCodeSVG } from "qrcode.react";

interface QuestionItem {
  id: string; // unique key for saving
  label: string;
  type: "text" | "check" | "choice" | "multiline";
  choices?: string[];
  hint?: string;
}

interface Section {
  title: string;
  icon: string;
  questions: QuestionItem[];
}

const SECTIONS: Section[] = [
  {
    title: "1. Dealership Identity",
    icon: "🏢",
    questions: [
      { id: "dealership_name", label: "Dealership Name", type: "text" },
      { id: "tagline", label: "Tagline / Slogan", type: "text" },
      { id: "phone", label: "Main Phone Number", type: "text" },
      { id: "email", label: "Main Email Address", type: "text" },
      { id: "address", label: "Physical Address", type: "text" },
      { id: "website", label: "Website URL", type: "text" },
      { id: "google_review", label: "Google Review Link", type: "text" },
      { id: "facebook", label: "Facebook URL", type: "text" },
      { id: "instagram", label: "Instagram URL", type: "text" },
      { id: "tiktok", label: "TikTok URL", type: "text" },
      { id: "youtube", label: "YouTube URL", type: "text" },
    ],
  },
  {
    title: "2. Architecture & BDC",
    icon: "🏗️",
    questions: [
      { id: "architecture", label: "Store Architecture", type: "choice", choices: ["Single Store", "Multi-Location", "Dealer Group"] },
      { id: "bdc_model", label: "BDC Model", type: "choice", choices: ["No BDC", "Single BDC", "Multi-Location BDC", "AI BDC"] },
      { id: "num_locations", label: "Number of Locations", type: "text" },
      { id: "billing_start", label: "Billing Start Date", type: "text" },
      { id: "billing_day", label: "Billing Day of Month (1–31)", type: "text" },
      { id: "special_instructions", label: "Special Instructions / Notes", type: "multiline" },
    ],
  },
  {
    title: "3. Branding & Colors",
    icon: "🎨",
    questions: [
      { id: "primary_color", label: "Primary Brand Color (hex)", type: "text", hint: "e.g. #1e3a5f" },
      { id: "accent_color", label: "Accent Color (hex)", type: "text" },
      { id: "success_color", label: "Success / CTA Color (hex)", type: "text" },
      { id: "offer_btn_color", label: "Offer Button Color (hex)", type: "text" },
      { id: "accept_btn_color", label: "Accept Button Color (hex)", type: "text" },
      { id: "logo_provided", label: "Logo file provided?", type: "check" },
      { id: "white_logo_provided", label: "White logo file provided?", type: "check" },
      { id: "favicon_provided", label: "Favicon provided?", type: "check" },
    ],
  },
  {
    title: "4. Hero & Landing Page",
    icon: "📢",
    questions: [
      { id: "hero_headline", label: "Hero Headline", type: "text", hint: 'e.g. "Sell Your Car in 2 Minutes"' },
      { id: "hero_subtext", label: "Hero Sub-text", type: "text" },
      { id: "hero_layout", label: "Hero Layout", type: "choice", choices: ["Offset Right", "Offset Left", "Stacked"] },
      { id: "enable_animations", label: "Enable page animations?", type: "choice", choices: ["Yes", "No"] },
      { id: "animated_calc", label: "Show animated offer calculation?", type: "choice", choices: ["Yes", "No"] },
    ],
  },
  {
    title: "5. Lead Form Flow",
    icon: "📝",
    questions: [
      { id: "flow_style", label: "Flow style", type: "choice", choices: ["Details First", "Offer First"], hint: "When should customer see their offer?" },
      { id: "step_vehicle_build", label: "Include Vehicle Build step?", type: "choice", choices: ["Yes", "No"] },
      { id: "step_condition", label: "Include Condition & History step?", type: "choice", choices: ["Yes", "No"] },
      { id: "guarantee_days", label: "Price Guarantee Days", type: "text", hint: "Default: 8" },
    ],
  },
  {
    title: "6. Vehicle Build Questions",
    icon: "🚗",
    questions: [
      { id: "q_ext_color", label: "Exterior Color", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_drivetrain", label: "Drivetrain", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_modifications", label: "Modifications", type: "choice", choices: ["Show", "Hide"] },
    ],
  },
  {
    title: "7. Condition & History Questions",
    icon: "🔧",
    questions: [
      { id: "q_condition", label: "Overall Condition Rating", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_ext_damage", label: "Exterior Damage", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_windshield", label: "Windshield Damage", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_moonroof", label: "Moonroof / Sunroof", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_int_damage", label: "Interior Damage", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_tech", label: "Technology Issues", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_engine", label: "Engine Issues", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_mechanical", label: "Mechanical Issues", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_drivable", label: "Drivable?", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_accidents", label: "Accidents", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_smoked", label: "Smoked In?", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_tires", label: "Tires Replaced?", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_keys", label: "Number of Keys", type: "choice", choices: ["Show", "Hide"] },
    ],
  },
  {
    title: "8. Finalize & Offer Questions",
    icon: "💰",
    questions: [
      { id: "q_loan", label: "Loan / Payoff Details", type: "choice", choices: ["Show", "Hide"] },
      { id: "q_next_step", label: "Next Step Preference", type: "choice", choices: ["Show", "Hide"] },
    ],
  },
  {
    title: "9. Photo Requirements",
    icon: "📷",
    questions: [
      { id: "overlay_color", label: "Ghost overlay color", type: "choice", choices: ["Green", "Red", "White"] },
      { id: "allow_color_change", label: "Allow customer to change overlay color?", type: "choice", choices: ["Yes", "No"] },
      { id: "image_angle", label: "Vehicle image angle", type: "choice", choices: ["3/4 Front Angle", "Side Profile"] },
      { id: "required_shots", label: "Required photo shots", type: "multiline", hint: "e.g. Front, Rear, Driver Side, Passenger Side, Dashboard, Odometer, VIN Plate, Engine Bay" },
    ],
  },
  {
    title: "10. Offer & Pricing",
    icon: "💵",
    questions: [
      { id: "value_basis", label: "Value Basis", type: "choice", choices: ["Wholesale Average", "Trade-In Average", "Wholesale Clean"] },
      { id: "dealer_pack", label: "Used Car Pack ($)", type: "text" },
      { id: "recon_cost", label: "Default Recon Cost ($)", type: "text" },
      { id: "hide_pack", label: "Hide pack from appraisal tool?", type: "choice", choices: ["Yes", "No"] },
      { id: "global_adj", label: "Global Adjustment %", type: "text", hint: "e.g. -5" },
      { id: "regional_adj", label: "Regional Adjustment %", type: "text" },
      { id: "offer_floor", label: "Offer Floor ($)", type: "text", hint: "Minimum offer amount" },
      { id: "offer_ceiling", label: "Offer Ceiling ($)", type: "text", hint: "Leave blank for no cap" },
    ],
  },
  {
    title: "11. Notifications",
    icon: "🔔",
    questions: [
      { id: "staff_emails", label: "Staff Email Recipients", type: "multiline", hint: "One per line" },
      { id: "staff_sms", label: "Staff SMS Recipients", type: "multiline", hint: "One per line" },
      { id: "notify_submission", label: "New Submission alerts", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "notify_hot_lead", label: "Hot Lead alerts", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "notify_abandoned", label: "Abandoned Lead alerts", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "notify_offer_ready", label: "Customer Offer Ready", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "quiet_hours", label: "Quiet Hours", type: "text", hint: "e.g. 9pm – 7am" },
    ],
  },
  {
    title: "12. Inspection Sheet",
    icon: "📋",
    questions: [
      { id: "show_tire_depth", label: "Show tire tread depth?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_brake_pads", label: "Show brake pad measurements?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_paint", label: "Show paint readings?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_oil", label: "Show oil life?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_battery", label: "Show battery health?", type: "choice", choices: ["Yes", "No"] },
      { id: "tire_adjustments", label: "Enable tire adjustments?", type: "choice", choices: ["Yes", "No"] },
      { id: "tire_mode", label: "Tire adjustment mode", type: "choice", choices: ["Whole (average)", "Per Tire"] },
    ],
  },
  {
    title: "13. Locations",
    icon: "📍",
    questions: [
      { id: "loc1_name", label: "Location 1 — Name", type: "text" },
      { id: "loc1_address", label: "Location 1 — Address", type: "text" },
      { id: "loc1_csz", label: "Location 1 — City, State, ZIP", type: "text" },
      { id: "loc1_brands", label: "Location 1 — OEM Brands", type: "text", hint: "e.g. Toyota, Honda" },
      { id: "loc2_name", label: "Location 2 — Name", type: "text" },
      { id: "loc2_address", label: "Location 2 — Address", type: "text" },
      { id: "loc2_csz", label: "Location 2 — City, State, ZIP", type: "text" },
      { id: "loc2_brands", label: "Location 2 — OEM Brands", type: "text" },
      { id: "loc3_name", label: "Location 3 — Name", type: "text" },
      { id: "loc3_address", label: "Location 3 — Address", type: "text" },
      { id: "loc3_csz", label: "Location 3 — City, State, ZIP", type: "text" },
      { id: "loc3_brands", label: "Location 3 — OEM Brands", type: "text" },
    ],
  },
  {
    title: "14. Lead Routing",
    icon: "🔀",
    questions: [
      { id: "assign_zip", label: "Auto-assign by ZIP?", type: "choice", choices: ["Yes", "No"] },
      { id: "assign_oem", label: "Auto-assign by OEM brand?", type: "choice", choices: ["Yes", "No"] },
      { id: "customer_picks", label: "Let customer pick location?", type: "choice", choices: ["Yes", "No"] },
      { id: "buying_center", label: "Use dedicated buying center?", type: "choice", choices: ["Yes", "No"] },
      { id: "buying_center_loc", label: "Buying Center Location", type: "text" },
    ],
  },
  {
    title: "15. Staff & Roles",
    icon: "👥",
    questions: [
      { id: "admin_users", label: "Admin Users (email)", type: "multiline" },
      { id: "gsm_users", label: "GSM/GM Users (email)", type: "multiline" },
      { id: "ucm_users", label: "Used Car Managers (email)", type: "multiline" },
      { id: "bdc_users", label: "Sales / BDC Users (email)", type: "multiline" },
    ],
  },
];

type Answers = Record<string, string>;

interface OnboardingScriptProps {
  targetDealershipId?: string | null;
}

export default function OnboardingScript({ targetDealershipId }: OnboardingScriptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { config } = useSiteConfig();
  const [answers, setAnswers] = useState<Answers>({});
  const [dealerSig, setDealerSig] = useState<string | null>(null);
  const [staffSig, setStaffSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Count filled answers
  const totalQuestions = SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);
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
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
  }, []);

  const toggleChoice = useCallback((id: string, choice: string) => {
    setAnswers((prev) => {
      const current = prev[id] || "";
      return { ...prev, [id]: current === choice ? "" : choice };
    });
    setDirty(true);
  }, []);

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

      {/* Progress bar */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{filledCount} of {totalQuestions} questions answered</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {savedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            Last saved: {savedAt}
            {dirty && <span className="text-destructive ml-2">• Unsaved changes</span>}
          </div>
        )}
      </div>

      {/* Printable content */}
      <div ref={printRef} className="space-y-6 print:space-y-4">
        {/* Print header */}
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-2xl font-bold">{config.dealership_name || "Dealer"} — Onboarding Script</h1>
          <p className="text-sm text-muted-foreground">
            Date: {new Date().toLocaleDateString()} &nbsp;&nbsp; Progress: {filledCount}/{totalQuestions}
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} className="border rounded-lg overflow-hidden print:break-inside-avoid">
            <div className="bg-muted/50 px-4 py-2.5 border-b">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>{section.icon}</span>
                {section.title}
              </h3>
            </div>
            <div className="divide-y">
              {section.questions.map((q) => (
                <div key={q.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.label}</p>
                    {q.hint && (
                      <p className="text-xs text-muted-foreground mt-0.5">{q.hint}</p>
                    )}
                  </div>
                  <div className="shrink-0 w-64">
                    {q.type === "text" && (
                      <>
                        {/* Screen: real input */}
                        <Input
                          className="h-8 text-sm print:hidden"
                          placeholder="—"
                          value={answers[q.id] || ""}
                          onChange={(e) => updateAnswer(q.id, e.target.value)}
                          maxLength={500}
                        />
                        {/* Print: show value or line */}
                        <div className="hidden print:block">
                          {answers[q.id] ? (
                            <p className="text-sm border-b border-muted-foreground/30 pb-1 min-h-[1.5rem]">
                              {answers[q.id]}
                            </p>
                          ) : (
                            <div className="border-b-2 border-dashed border-muted-foreground/30 h-6" />
                          )}
                        </div>
                      </>
                    )}

                    {q.type === "multiline" && (
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
                            <p className="text-sm whitespace-pre-line border-b border-muted-foreground/30 pb-1">
                              {answers[q.id]}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="border-b-2 border-dashed border-muted-foreground/30 h-5" />
                              <div className="border-b-2 border-dashed border-muted-foreground/30 h-5" />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {q.type === "check" && (
                      <div className="flex items-center gap-3 h-8">
                        <button
                          type="button"
                          onClick={() => toggleChoice(q.id, "yes")}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                            answers[q.id] === "yes"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleChoice(q.id, "no")}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                            answers[q.id] === "no"
                              ? "bg-destructive text-destructive-foreground border-destructive"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    )}

                    {q.type === "choice" && q.choices && (
                      <div className="flex flex-wrap gap-1.5">
                        {q.choices.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleChoice(q.id, c)}
                            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                              answers[q.id] === c
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Digital Signature Block */}
        <div className="border rounded-lg p-6 print:break-inside-avoid print:mt-8">
          <h3 className="text-sm font-bold mb-1">Sign-Off</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Both parties sign below to confirm the onboarding configuration is agreed upon.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Print fallback */}
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

            {/* Digital signature pads */}
            <div className="print:hidden">
              <SignaturePad label="Dealer Representative" value={dealerSig} onChange={(v) => { setDealerSig(v); setDirty(true); }} />
            </div>
            <div className="print:hidden">
              <SignaturePad label="Onboarding Specialist" value={staffSig} onChange={(v) => { setStaffSig(v); setDirty(true); }} />
            </div>
          </div>

          <div className="mt-4 print:hidden">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save All"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

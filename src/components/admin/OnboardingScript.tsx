import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Save, CheckCircle2, Square } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SignaturePad from "./SignaturePad";

interface QuestionItem {
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
      { label: "Dealership Name", type: "text" },
      { label: "Tagline / Slogan", type: "text" },
      { label: "Main Phone Number", type: "text" },
      { label: "Main Email Address", type: "text" },
      { label: "Physical Address", type: "text" },
      { label: "Website URL", type: "text" },
      { label: "Google Review Link", type: "text" },
      { label: "Facebook URL", type: "text" },
      { label: "Instagram URL", type: "text" },
      { label: "TikTok URL", type: "text" },
      { label: "YouTube URL", type: "text" },
    ],
  },
  {
    title: "2. Architecture & BDC",
    icon: "🏗️",
    questions: [
      { label: "Store Architecture", type: "choice", choices: ["Single Store", "Multi-Location", "Dealer Group"] },
      { label: "BDC Model", type: "choice", choices: ["No BDC", "Single BDC", "Multi-Location BDC", "AI BDC"] },
      { label: "Number of Locations", type: "text" },
      { label: "Billing Start Date", type: "text" },
      { label: "Billing Day of Month (1–31)", type: "text" },
      { label: "Special Instructions / Notes", type: "multiline" },
    ],
  },
  {
    title: "3. Branding & Colors",
    icon: "🎨",
    questions: [
      { label: "Primary Brand Color (hex)", type: "text", hint: "e.g. #1e3a5f" },
      { label: "Accent Color (hex)", type: "text" },
      { label: "Success / CTA Color (hex)", type: "text" },
      { label: "Offer Button Color (hex)", type: "text" },
      { label: "Accept Button Color (hex)", type: "text" },
      { label: "Logo file provided?", type: "check" },
      { label: "White logo file provided?", type: "check" },
      { label: "Favicon provided?", type: "check" },
    ],
  },
  {
    title: "4. Hero & Landing Page",
    icon: "📢",
    questions: [
      { label: "Hero Headline", type: "text", hint: 'e.g. "Sell Your Car in 2 Minutes"' },
      { label: "Hero Sub-text", type: "text" },
      { label: "Hero Layout", type: "choice", choices: ["Offset Right (form beside hero)", "Offset Left", "Stacked (hero then form)"] },
      { label: "Enable page animations?", type: "choice", choices: ["Yes", "No"] },
      { label: "Show animated offer calculation?", type: "choice", choices: ["Yes", "No"] },
    ],
  },
  {
    title: "5. Lead Form Flow",
    icon: "📝",
    questions: [
      { label: "Flow style", type: "choice", choices: ["Details First (traditional — contact then offer)", "Offer First (CarMax/Peddle style — offer then contact)"], hint: "When should customer see their offer?" },
      { label: "Include Vehicle Build step?", type: "choice", choices: ["Yes", "No"] },
      { label: "Include Condition & History step?", type: "choice", choices: ["Yes", "No"] },
      { label: "Price Guarantee Days", type: "text", hint: "Default: 8" },
    ],
  },
  {
    title: "6. Vehicle Build Questions (toggle each)",
    icon: "🚗",
    questions: [
      { label: "Exterior Color", type: "choice", choices: ["Show", "Hide"] },
      { label: "Drivetrain", type: "choice", choices: ["Show", "Hide"] },
      { label: "Modifications", type: "choice", choices: ["Show", "Hide"] },
    ],
  },
  {
    title: "7. Condition & History Questions (toggle each)",
    icon: "🔧",
    questions: [
      { label: "Overall Condition Rating", type: "choice", choices: ["Show", "Hide"] },
      { label: "Exterior Damage", type: "choice", choices: ["Show", "Hide"] },
      { label: "Windshield Damage", type: "choice", choices: ["Show", "Hide"] },
      { label: "Moonroof / Sunroof", type: "choice", choices: ["Show", "Hide"] },
      { label: "Interior Damage", type: "choice", choices: ["Show", "Hide"] },
      { label: "Technology Issues", type: "choice", choices: ["Show", "Hide"] },
      { label: "Engine Issues", type: "choice", choices: ["Show", "Hide"] },
      { label: "Mechanical Issues", type: "choice", choices: ["Show", "Hide"] },
      { label: "Drivable?", type: "choice", choices: ["Show", "Hide"] },
      { label: "Accidents", type: "choice", choices: ["Show", "Hide"] },
      { label: "Smoked In?", type: "choice", choices: ["Show", "Hide"] },
      { label: "Tires Replaced?", type: "choice", choices: ["Show", "Hide"] },
      { label: "Number of Keys", type: "choice", choices: ["Show", "Hide"] },
    ],
  },
  {
    title: "8. Finalize & Offer Questions",
    icon: "💰",
    questions: [
      { label: "Loan / Payoff Details", type: "choice", choices: ["Show", "Hide"] },
      { label: "Next Step Preference", type: "choice", choices: ["Show", "Hide"] },
    ],
  },
  {
    title: "9. Photo Requirements",
    icon: "📷",
    questions: [
      { label: "Ghost overlay color", type: "choice", choices: ["Green", "Red", "White"] },
      { label: "Allow customer to change overlay color?", type: "choice", choices: ["Yes", "No"] },
      { label: "Vehicle image angle", type: "choice", choices: ["3/4 Front Angle", "Side Profile"] },
      { label: "Required photo shots (list / check all):", type: "multiline", hint: "e.g. Front, Rear, Driver Side, Passenger Side, Dashboard, Odometer, VIN Plate, Engine Bay" },
    ],
  },
  {
    title: "10. Offer & Pricing",
    icon: "💵",
    questions: [
      { label: "Value Basis", type: "choice", choices: ["Wholesale Average", "Trade-In Average", "Wholesale Clean"] },
      { label: "Used Car Pack ($)", type: "text" },
      { label: "Default Recon Cost ($)", type: "text" },
      { label: "Hide pack from appraisal tool?", type: "choice", choices: ["Yes — combine into recon", "No — show separately"] },
      { label: "Global Adjustment %", type: "text", hint: "e.g. -5" },
      { label: "Regional Adjustment %", type: "text" },
      { label: "Offer Floor ($)", type: "text", hint: "Minimum offer amount" },
      { label: "Offer Ceiling ($)", type: "text", hint: "Leave blank for no cap" },
    ],
  },
  {
    title: "11. Notifications",
    icon: "🔔",
    questions: [
      { label: "Staff Email Recipients", type: "multiline", hint: "One per line" },
      { label: "Staff SMS Recipients", type: "multiline", hint: "One per line" },
      { label: "Enable New Submission alerts?", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { label: "Enable Hot Lead alerts?", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { label: "Enable Abandoned Lead alerts?", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { label: "Enable Customer Offer Ready?", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { label: "Quiet Hours?", type: "text", hint: "e.g. 9pm – 7am" },
    ],
  },
  {
    title: "12. Inspection Sheet",
    icon: "📋",
    questions: [
      { label: "Show tire tread depth?", type: "choice", choices: ["Yes", "No"] },
      { label: "Show brake pad measurements?", type: "choice", choices: ["Yes", "No"] },
      { label: "Show paint readings?", type: "choice", choices: ["Yes", "No"] },
      { label: "Show oil life?", type: "choice", choices: ["Yes", "No"] },
      { label: "Show battery health?", type: "choice", choices: ["Yes", "No"] },
      { label: "Enable tire adjustments?", type: "choice", choices: ["Yes", "No"] },
      { label: "Tire adjustment mode", type: "choice", choices: ["Whole (average)", "Per Tire"] },
    ],
  },
  {
    title: "13. Locations",
    icon: "📍",
    questions: [
      { label: "Location 1 — Name", type: "text" },
      { label: "Location 1 — Address", type: "text" },
      { label: "Location 1 — City, State, ZIP", type: "text" },
      { label: "Location 1 — OEM Brands", type: "text", hint: "e.g. Toyota, Honda" },
      { label: "Location 2 — Name", type: "text" },
      { label: "Location 2 — Address", type: "text" },
      { label: "Location 2 — City, State, ZIP", type: "text" },
      { label: "Location 2 — OEM Brands", type: "text" },
      { label: "Location 3 — Name", type: "text" },
      { label: "Location 3 — Address", type: "text" },
      { label: "Location 3 — City, State, ZIP", type: "text" },
      { label: "Location 3 — OEM Brands", type: "text" },
    ],
  },
  {
    title: "14. Lead Routing",
    icon: "🔀",
    questions: [
      { label: "Auto-assign by ZIP?", type: "choice", choices: ["Yes", "No"] },
      { label: "Auto-assign by OEM brand?", type: "choice", choices: ["Yes", "No"] },
      { label: "Let customer pick location?", type: "choice", choices: ["Yes", "No"] },
      { label: "Use dedicated buying center?", type: "choice", choices: ["Yes", "No"] },
      { label: "Buying Center Location", type: "text" },
    ],
  },
  {
    title: "15. Staff & Roles",
    icon: "👥",
    questions: [
      { label: "Admin Users (email)", type: "multiline" },
      { label: "GSM/GM Users (email)", type: "multiline" },
      { label: "Used Car Managers (email)", type: "multiline" },
      { label: "Sales / BDC Users (email)", type: "multiline" },
    ],
  },
];

export default function OnboardingScript() {
  const printRef = useRef<HTMLDivElement>(null);
  const { config } = useSiteConfig();
  const [dealerSig, setDealerSig] = useState<string | null>(null);
  const [staffSig, setStaffSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load existing signatures
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("dealer_accounts")
        .select("onboarding_signature_dealer, onboarding_signature_staff, onboarding_signed_at")
        .eq("dealership_id", "default")
        .maybeSingle();
      if (data) {
        setDealerSig(data.onboarding_signature_dealer);
        setStaffSig(data.onboarding_signature_staff);
        if (data.onboarding_signed_at) {
          setSavedAt(new Date(data.onboarding_signed_at).toLocaleString());
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!dealerSig && !staffSig) {
      toast.error("At least one signature is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("dealer_accounts")
      .update({
        onboarding_signature_dealer: dealerSig,
        onboarding_signature_staff: staffSig,
        onboarding_signed_at: new Date().toISOString(),
      } as any)
      .eq("dealership_id", "default");

    if (error) {
      toast.error("Failed to save signatures");
    } else {
      setSavedAt(new Date().toLocaleString());
      toast.success("Signatures saved successfully");
    }
    setSaving(false);
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-4xl">
      {/* Screen-only header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h2 className="text-xl font-semibold">Onboarding Questionnaire</h2>
          <p className="text-sm text-muted-foreground">
            Walk through every customization option with the dealer. Print or use on a tablet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} size="sm" variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="space-y-6 print:space-y-4">
        {/* Print header */}
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-2xl font-bold">{config.dealership_name || "Dealer"} — Onboarding Script</h1>
          <p className="text-sm text-muted-foreground">Date: ____________ &nbsp;&nbsp; Completed by: ____________</p>
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
              {section.questions.map((q, idx) => (
                <div key={idx} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.label}</p>
                    {q.hint && (
                      <p className="text-xs text-muted-foreground mt-0.5">{q.hint}</p>
                    )}
                  </div>
                  <div className="shrink-0 w-56 print:w-64">
                    {q.type === "text" && (
                      <div className="border-b-2 border-dashed border-muted-foreground/30 h-7 print:h-6" />
                    )}
                    {q.type === "multiline" && (
                      <div className="space-y-2">
                        <div className="border-b-2 border-dashed border-muted-foreground/30 h-7 print:h-5" />
                        <div className="border-b-2 border-dashed border-muted-foreground/30 h-7 print:h-5" />
                        <div className="border-b-2 border-dashed border-muted-foreground/30 h-7 print:h-5" />
                      </div>
                    )}
                    {q.type === "check" && (
                      <div className="flex items-center gap-2 h-7">
                        <Square className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Yes</span>
                        <Square className="w-4 h-4 text-muted-foreground ml-2" />
                        <span className="text-xs text-muted-foreground">No</span>
                      </div>
                    )}
                    {q.type === "choice" && q.choices && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {q.choices.map((c) => (
                          <label key={c} className="flex items-center gap-1.5 text-xs">
                            <Square className="w-3.5 h-3.5 text-muted-foreground print:w-3 print:h-3" />
                            {c}
                          </label>
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

          {savedAt && (
            <div className="flex items-center gap-2 text-xs text-success mb-4 print:hidden">
              <CheckCircle2 className="w-4 h-4" />
              Last signed: {savedAt}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Print fallback lines */}
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

            {/* Digital signature pads — screen only */}
            <div className="print:hidden">
              <SignaturePad
                label="Dealer Representative"
                value={dealerSig}
                onChange={setDealerSig}
              />
            </div>
            <div className="print:hidden">
              <SignaturePad
                label="Onboarding Specialist"
                value={staffSig}
                onChange={setStaffSig}
              />
            </div>
          </div>

          <div className="mt-4 print:hidden">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Signatures"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

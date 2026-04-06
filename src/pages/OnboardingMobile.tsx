import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, CheckCircle2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import SignaturePad from "@/components/admin/SignaturePad";
import { cn } from "@/lib/utils";
import { getMobileSections, sectionProgress, getSmartDefaults } from "@/lib/onboardingSections";
import type { QuestionItem } from "@/lib/onboardingSections";

type Answers = Record<string, string>;

export default function OnboardingMobile() {
  const { dealershipId } = useParams<{ dealershipId: string }>();
  const [answers, setAnswers] = useState<Answers>({});
  const [dealerSig, setDealerSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [dealerName, setDealerName] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const did = dealershipId || "default";
  const sections = getMobileSections();

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const filledCount = Object.values(answers).filter((v) => v?.trim()).length;
  const progressPct = totalQuestions > 0 ? Math.round((filledCount / totalQuestions) * 100) : 0;

  useEffect(() => {
    const load = async () => {
      const [acctRes, configRes] = await Promise.all([
        supabase
          .from("dealer_accounts")
          .select("onboarding_answers, onboarding_signature_dealer")
          .eq("dealership_id", did)
          .maybeSingle(),
        supabase
          .from("site_config")
          .select("dealership_name")
          .eq("dealership_id", did)
          .maybeSingle(),
      ]);
      if (acctRes.data) {
        if (acctRes.data.onboarding_answers && typeof acctRes.data.onboarding_answers === "object") {
          setAnswers(acctRes.data.onboarding_answers as Answers);
        }
        setDealerSig((acctRes.data as any).onboarding_signature_dealer || null);
      }
      if (configRes.data) {
        setDealerName(configRes.data.dealership_name || "");
      }
      // Open the first section by default
      if (sections.length > 0) {
        setOpenSections(new Set([sections[0].title]));
      }
      setLoading(false);
    };
    load();
  }, [did]);

  const updateAnswer = (id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      if (id === "architecture") {
        const defaults = getSmartDefaults(value);
        for (const [k, v] of Object.entries(defaults)) {
          if (!next[k]?.trim()) next[k] = v;
        }
      }
      return next;
    });
  };

  const toggleChoice = (id: string, choice: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: prev[id] === choice ? "" : choice };
      if (id === "architecture" && prev[id] !== choice) {
        const defaults = getSmartDefaults(choice);
        for (const [k, v] of Object.entries(defaults)) {
          if (!next[k]?.trim()) next[k] = v;
        }
      }
      return next;
    });
  };

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleSave = async () => {
    if (!dealerSig) {
      toast.error("Please sign before saving");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("dealer_accounts")
      .update({
        onboarding_answers: answers,
        onboarding_signature_dealer: dealerSig,
        onboarding_signed_at: new Date().toISOString(),
      } as any)
      .eq("dealership_id", did);

    if (error) {
      toast.error("Failed to save");
    } else {
      setSaved(true);
      toast.success("Saved! Your onboarding specialist will review.");
    }
    setSaving(false);
  };

  const renderQuestion = (q: QuestionItem) => {
    if (q.type === "text") {
      return (
        <Input
          className="h-9 text-sm"
          placeholder="—"
          value={answers[q.id] || ""}
          onChange={(e) => updateAnswer(q.id, e.target.value)}
          maxLength={500}
        />
      );
    }

    if (q.type === "multiline") {
      return (
        <Textarea
          className="text-sm min-h-[60px]"
          placeholder="—"
          value={answers[q.id] || ""}
          onChange={(e) => updateAnswer(q.id, e.target.value)}
          maxLength={2000}
        />
      );
    }

    if (q.type === "check") {
      return (
        <div className="flex items-center gap-3">
          {["yes", "no"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => toggleChoice(q.id, v)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                answers[q.id] === v
                  ? v === "yes"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-destructive text-destructive-foreground border-destructive"
                  : "border-border hover:bg-muted"
              }`}
            >
              {v === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );
    }

    if (q.type === "choice" && q.choices) {
      // Acquisition intent slider on mobile too
      if (q.id === "acquisition_intent") {
        return (
          <div className="w-full space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>🟢 Conservative</span>
              <span>🔴 Predator</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #22c55e, #eab308, #ef4444)" }}>
              {(() => {
                const idx = q.choices!.indexOf(answers[q.id] || "");
                if (idx < 0) return null;
                const pct = (idx / (q.choices!.length - 1)) * 100;
                return <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background border-2 border-foreground shadow-md transition-all" style={{ left: `calc(${pct}% - 10px)` }} />;
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
            <button
              key={c}
              type="button"
              onClick={() => toggleChoice(q.id, c)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                answers[q.id] === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">All Set!</h1>
          <p className="text-muted-foreground">
            Your onboarding answers and signature have been saved. Your specialist will review and configure your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Onboarding</h1>
            <p className="text-xs text-muted-foreground">{dealerName || "New Dealer Setup"}</p>
          </div>
          <Button onClick={handleSave} size="sm" disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-3 pb-32">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filledCount}/{totalQuestions} answered</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {sections.map((section) => {
          const { filled, total } = sectionProgress(section, answers);
          const isComplete = filled === total && total > 0;
          const isOpen = openSections.has(section.title);

          return (
            <div key={section.title} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                  isOpen ? "bg-muted/50 border-b" : "bg-muted/30"
                )}
              >
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>{section.icon}</span>
                  {section.title}
                  {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    isComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {filled}/{total}
                  </span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="divide-y">
                  {section.questions.map((q) => (
                    <div key={q.id} className="px-4 py-3 space-y-1.5">
                      <p className="text-sm font-medium">{q.label}</p>
                      {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
                      {renderQuestion(q)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Signature */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-bold">Your Signature</h3>
          <p className="text-xs text-muted-foreground">
            Sign below to confirm you've provided accurate information for your account setup.
          </p>
          <SignaturePad
            label="Dealer Representative"
            value={dealerSig}
            onChange={setDealerSig}
          />
        </div>

        {/* Bottom save */}
        <Button onClick={handleSave} disabled={saving} className="w-full gap-2" size="lg">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Submit & Save"}
        </Button>
      </div>
    </div>
  );
}

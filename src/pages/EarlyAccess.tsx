import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Rocket,
  ShieldCheck,
  Headset,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * AutoCurb.io early-access signup — autocurb.io/early-access.
 * Standalone, platform-branded (matches /platform), not tenant chrome.
 * Writes to the public.early_access_signups table (anon insert).
 *
 * Route: /early-access
 */

const PERKS = [
  {
    icon: Tag,
    title: "Founding-Dealer Pricing",
    description:
      "Lock in early-access rates before general availability — and keep them as the platform expands.",
  },
  {
    icon: Headset,
    title: "White-Glove Onboarding",
    description:
      "We build your embed, dedicated trade page, and showroom workflow with you — not a help-desk ticket.",
  },
  {
    icon: Rocket,
    title: "Shape the Roadmap",
    description:
      "Early dealers get a direct line to the team and first say on what we build next.",
  },
  {
    icon: ShieldCheck,
    title: "No Auction Lane Risk",
    description:
      "Start sourcing cars direct from consumers the week you go live. Every unit off the lane is pure gross.",
  },
];

const ROOFTOP_OPTIONS = ["1", "2-5", "6-20", "21-50", "50+"];

const EarlyAccess = () => {
  const { toast } = useToast();

  const [contactName, setContactName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rooftops, setRooftops] = useState("");
  const [currentSolution, setCurrentSolution] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = dealershipName.trim() !== "" && email.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const { error } = await (supabase as any).from("early_access_signups").insert({
      contact_name: contactName.trim() || null,
      dealership_name: dealershipName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      rooftops: rooftops || null,
      current_solution: currentSolution.trim() || null,
    });

    if (error) {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again, or email sales@autocurb.io.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
    toast({
      title: "You're on the list",
      description: "We'll reach out shortly to get you set up.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Get Early Access | AutoCurb.io"
        description="Be among the first dealers on AutoCurb.io — the dealer acquisition operating system. Founding-dealer pricing, white-glove onboarding, and direct-from-consumer sourcing. Request early access."
        path="/early-access"
        siteName="AutoCurb.io"
      />

      {/* ── Sticky Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/platform" className="flex items-center gap-2.5">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#4a4a4a] dark:text-slate-200">Auto</span>
              <span className="text-[#4CAF50]">Curb</span>
              <span className="text-[#4a4a4a] dark:text-slate-400 text-base">.io</span>
            </span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-semibold border-l border-border/60 pl-2.5 ml-0.5">
              Bring the Curb to the Cloud
            </span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/platform">See the Platform</Link>
          </Button>
        </div>
      </header>

      {/* ── Hero + Form ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4CAF50]/[0.06] via-transparent to-[#4CAF50]/[0.03]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left: pitch */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#4CAF50]/30 bg-[#4CAF50]/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#4CAF50]">
                <Sparkles className="w-3.5 h-3.5" />
                Early Access — Now Onboarding Dealers
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#333] dark:text-slate-100 leading-[1.1]">
                Get Early Access to{" "}
                <span className="text-[#4CAF50]">AutoCurb.io</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                The dealer acquisition operating system — your website, your trade
                page, and your showroom on one platform. Sign up below and we'll
                reach out to get your rooftop live.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {PERKS.map((perk) => {
                  const Icon = perk.icon;
                  return (
                    <div key={perk.title} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4.5 h-4.5 text-[#4CAF50]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-card-foreground">
                          {perk.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                          {perk.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: form card */}
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-border/60 bg-card shadow-lg p-6 sm:p-8">
                {submitted ? (
                  <div className="text-center space-y-4 py-6">
                    <div className="w-14 h-14 rounded-full bg-[#4CAF50]/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 text-[#4CAF50]" />
                    </div>
                    <h2 className="text-2xl font-bold text-card-foreground">
                      You're on the list
                    </h2>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Thanks{contactName.trim() ? `, ${contactName.trim().split(" ")[0]}` : ""}!
                      We'll reach out to{" "}
                      <span className="font-semibold text-card-foreground">{email.trim()}</span>{" "}
                      shortly to get {dealershipName.trim() || "your store"} set up.
                    </p>
                    <div className="pt-2">
                      <Button variant="outline" className="border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/5" asChild>
                        <Link to="/platform">
                          Explore the platform
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-card-foreground">
                        Request Early Access
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Takes 30 seconds. No credit card.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="dealershipName">
                        Dealership name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="dealershipName"
                        value={dealershipName}
                        onChange={(e) => setDealershipName(e.target.value)}
                        placeholder="Harte Auto Group"
                        autoComplete="organization"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contactName">Your name</Label>
                      <Input
                        id="contactName"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Jane Dealer"
                        autoComplete="name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Work email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@dealership.com"
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(866) 851-7390"
                        autoComplete="tel"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rooftops">Number of rooftops</Label>
                      <Select value={rooftops} onValueChange={setRooftops}>
                        <SelectTrigger id="rooftops">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROOFTOP_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="currentSolution">
                        What are you using today? <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Textarea
                        id="currentSolution"
                        value={currentSolution}
                        onChange={(e) => setCurrentSolution(e.target.value)}
                        placeholder="KBB ICO, vAuto, auctions, nothing yet…"
                        rows={2}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={!canSubmit || submitting}
                      className="w-full gap-2 bg-[#4CAF50] hover:bg-[#43A047] text-white"
                    >
                      {submitting ? "Submitting…" : "Request Early Access"}
                      {!submitting && <ArrowRight className="w-4 h-4" />}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      By requesting access you agree to our{" "}
                      <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold">
              <span className="text-[#4a4a4a] dark:text-slate-300">Auto</span>
              <span className="text-[#4CAF50]">Curb</span>
              <span className="text-[#4a4a4a] dark:text-slate-400">.io</span>
            </span>
            <span>· Bring the Curb to the Cloud</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/platform" className="hover:text-foreground transition-colors">Platform</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EarlyAccess;

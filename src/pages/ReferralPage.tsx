import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Gift, DollarSign, Users, CheckCircle, ArrowRight, Star, TrendingUp, Handshake, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SEO from "@/components/SEO";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { icon: Users, title: "Sign Up as a Referrer", desc: "Register below with your name, email, and phone. You'll get your own unique referral link." },
  { icon: Handshake, title: "Share With Anyone", desc: "Send your link to friends, family, coworkers — anyone with a car to sell or trade." },
  { icon: DollarSign, title: "Get Paid!", desc: "When someone you referred sells or trades their vehicle with us, you earn up to $200. No limits!" },
];

const benefits = [
  "Earn up to $200 per referral — check or gift card, your choice",
  "No limit on how many people you can refer",
  "Track your referrals and earnings anytime",
  "Your friends get a fast, fair, no-hassle car selling experience",
  "Perfect for auto enthusiasts, community leaders, or anyone who knows people with cars",
];

const ReferralPage = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const dealerName = config.dealership_name || "Our Dealership";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    const code = generateCode();
    const link = `${window.location.origin}/?ref=${code}`;

    const { error } = await supabase.from("referrals").insert({
      dealership_id: tenant.dealership_id,
      referral_code: code,
      referrer_name: name,
      referrer_email: email,
      referrer_phone: phone || null,
      status: "pending",
      reward_amount: 200,
      notes: note || null,
    } as any);

    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
    } else {
      setReferralLink(link);
      setSubmitted(true);
      toast({ title: "You're registered! 🎉", description: "Your referral link is ready to share." });
    }
    setSubmitting(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Your referral link is on the clipboard." });
  };

  const sendSms = () => {
    if (!smsPhone.trim()) return;
    const message = `Hey! I just signed up with ${dealerName} to sell/trade cars and earn rewards. Check them out using my link: ${referralLink}`;
    const smsUrl = `sms:${smsPhone.trim()}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, "_self");
    setSmsSent(true);
    toast({ title: "Text ready!", description: "Your messaging app should open with the referral link pre-filled." });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Referral Program — Earn Up to $200 | ${dealerName}`}
        description={`Refer friends, family, or coworkers to sell or trade their car with ${dealerName}. Earn up to $200 per referral. No limits!`}
        path="/referral"
      />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 text-8xl">💰</div>
            <div className="absolute bottom-10 right-10 text-8xl">🚗</div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl opacity-5">🎉</div>
          </div>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
                <Gift className="w-4 h-4" />
                <span className="text-sm font-semibold">Referral Program</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                Earn Up to $200 Per Referral
              </h1>
              <p className="text-lg md:text-xl opacity-90 max-w-xl mx-auto">
                Know someone with a car to sell or trade? Send them our way and we'll send you a check — it's that simple.
              </p>
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 px-4 bg-card">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-card-foreground text-center mb-12">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-sm font-bold text-primary mb-1">Step {i + 1}</div>
                  <h3 className="text-lg font-bold text-card-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  {i < steps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-muted-foreground/30 mx-auto mt-4 hidden md:block rotate-0" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-4 bg-muted/50">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Why Become a Referrer?</h2>
            </div>
            <div className="bg-card rounded-2xl shadow-lg p-6 md:p-8 border border-border">
              <ul className="space-y-4">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Be a Virtual Salesperson</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Think of it like a side hustle — every car you send our way puts money in your pocket.
                  No sales experience needed. Just share your link!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Registration Form */}
        <section id="register" className="py-16 px-4 bg-card">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <Gift className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="text-2xl md:text-3xl font-bold text-card-foreground">
                {submitted ? "You're In! 🎉" : "Register as a Referrer"}
              </h2>
              <p className="text-muted-foreground mt-2">
                {submitted
                  ? "Share your unique link with anyone you know — start earning today!"
                  : "Sign up to get your unique referral link. It takes 30 seconds."}
              </p>
            </div>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-muted rounded-2xl p-6 border border-border text-center space-y-4"
              >
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Referral Link</p>
                <div className="bg-background rounded-xl p-4 border border-border">
                  <code className="text-sm text-primary font-mono break-all">{referralLink}</code>
                </div>
                <Button onClick={copyLink} className="w-full">
                  Copy My Link
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-muted px-2 text-muted-foreground">or text it directly</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    value={smsPhone}
                    onChange={e => setSmsPhone(e.target.value)}
                    placeholder="Friend's phone number"
                    className="flex-1"
                  />
                  <Button
                    onClick={sendSms}
                    disabled={!smsPhone.trim()}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {smsSent && (
                  <p className="text-xs text-success flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Message opened — check your texts!
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Share via text, email, or social media. When someone clicks your link and sells their car, you get paid!
                </p>
              </motion.div>
            ) : (
              <div className="bg-muted rounded-2xl p-6 border border-border space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Your Name *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Email Address *</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Phone (optional)</label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(860) 555-1234" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">How do you know about us? (optional)</label>
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="I'm a past customer, I work nearby, a friend told me..."
                    rows={2}
                  />
                </div>
                <Button
                  onClick={handleRegister}
                  disabled={!name.trim() || !email.trim() || submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? "Setting up..." : "Get My Referral Link →"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  By registering you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* FAQ-style bottom section */}
        <section className="py-12 px-4 bg-muted/30">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-lg font-bold text-foreground mb-4">Frequently Asked Questions</h3>
            <div className="text-left space-y-4">
              {[
                { q: "How much can I earn?", a: "Up to $200 per successful referral. There's no limit on how many people you can refer." },
                { q: "When do I get paid?", a: "Once the person you referred completes their sale or trade-in, we'll contact you to arrange your reward — check or gift card, your choice." },
                { q: "Does the person I refer get anything?", a: "They get a fast, fair, hassle-free experience! We treat every customer like a VIP, especially referrals." },
                { q: "Can I refer multiple people?", a: "Absolutely! Every referral that converts earns you a reward. Think of it as your own side hustle." },
              ].map(({ q, a }) => (
                <div key={q} className="bg-card rounded-xl p-4 border border-border">
                  <p className="font-semibold text-foreground text-sm">{q}</p>
                  <p className="text-sm text-muted-foreground mt-1">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default ReferralPage;

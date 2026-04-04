import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Clock, Award, HandshakeIcon, ChevronRight, Building2,
  Heart, Star, CheckCircle, Users, Zap, Target, Smile, ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig, type AboutMilestone, type AboutValue } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { LocalBusinessJsonLd } from "@/components/JsonLd";
import { Button } from "@/components/ui/button";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  HandshakeIcon, Shield, Clock, Award, Heart, Star, CheckCircle, Users, Zap, Target, Smile, ThumbsUp,
};

const DEFAULT_MILESTONES: AboutMilestone[] = [
  { year: "Day 1", label: "Founded with a mission to make selling your car simple" },
  { year: "Growth", label: "Expanded operations and built a reputation for fairness" },
  { year: "Digital", label: "Launched an online platform for instant cash offers" },
  { year: "Today", label: "Thousands of vehicles purchased from happy customers" },
];

const DEFAULT_VALUES: AboutValue[] = [
  { icon: "HandshakeIcon", title: "You're Family Here", text: "Every customer deserves to be treated like family. No pressure, no games — just honest conversations." },
  { icon: "Shield", title: "Nothing Hidden, Ever", text: "Every offer includes a full breakdown. We show you exactly how we valued your vehicle, what we factored in, and what you'll walk away with." },
  { icon: "Clock", title: "Your Time Matters", text: "Get a real offer in under 2 minutes — not 2 hours at a dealership. We handle the loan payoffs, the paperwork, and we'll even come pick up your car." },
  { icon: "Award", title: "Earned Trust, Not Bought", text: "Our reputation comes from decades of keeping our word and treating people right." },
];

const DEFAULT_STORY = "";

const AboutPage = () => {
  const { config } = useSiteConfig();
  const name = config.dealership_name || "Our Dealership";
  const [locations, setLocations] = useState<DealerLocation[]>([]);

  const milestones = config.about_milestones?.length ? config.about_milestones : DEFAULT_MILESTONES;
  const values = config.about_values?.length ? config.about_values : DEFAULT_VALUES;
  const heroHeadline = config.about_hero_headline || "Four Generations. One Promise.";
  const heroSubtext = config.about_hero_subtext || "Since 1951, the Harte family has been helping Connecticut drivers — not just sell and buy cars, but feel good about the experience. That's the only way we know how to do it.";
  const customStory = config.about_story || DEFAULT_STORY;

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address")
        .eq("is_active", true)
        .order("sort_order");
      if (data) setLocations(data as unknown as DealerLocation[]);
    };
    fetchLocations();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`About ${name} — CT's Trusted Car Buyer Since 1951`}
        description={`Four generations of the ${name} family have purchased ${config.stats_cars_purchased || "14,700+"} vehicles across Connecticut. ${config.stats_rating || "4.9"}-star rating, ${config.stats_reviews_count || "2,400+"} reviews. Learn our story.`}
        path="/about"
      />
      <LocalBusinessJsonLd />
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="bg-primary text-primary-foreground py-16 md:py-24 px-5">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-widest opacity-70 mb-3">About Us</p>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-5"
              dangerouslySetInnerHTML={{ __html: heroHeadline.replace(/\n/g, "<br />") }}
            />
            <p className="text-lg md:text-xl opacity-85 max-w-2xl mx-auto leading-relaxed">
              {heroSubtext}
            </p>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="bg-card border-b border-border py-8 px-5" aria-label="Key statistics">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <div>
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary">
                <AnimatedCounter target={parseInt((config.stats_years_in_business || "74").replace(/\D/g, "")) || 74} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Years in Business</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary">
                <AnimatedCounter target={parseInt((config.stats_cars_purchased || "14721").replace(/\D/g, "")) || 14721} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Vehicles Purchased</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary">{config.stats_rating || "4.9"}</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Average Rating</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary">
                <AnimatedCounter target={parseInt((config.stats_reviews_count || "2400").replace(/\D/g, "")) || 2400} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Verified Reviews</p>
            </div>
          </div>
        </section>

        {/* ── Our Story ── */}
        <section className="py-14 md:py-20 px-5" aria-label="Our story">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-6 text-center">Our Story</h2>
            {customStory ? (
              <div
                className="prose prose-sm max-w-none text-foreground/85 space-y-4"
                dangerouslySetInnerHTML={{ __html: customStory }}
              />
            ) : (
              <div className="prose prose-sm max-w-none text-foreground/85 space-y-4">
                <p>
                  It started with a handshake. In <strong>1951</strong>, George Harte Sr.
                  opened a Chevrolet dealership in Connecticut with one simple belief:
                  <em> treat every person who walks through your door like family</em>. He
                  didn't have a marketing team or a mission statement — just a genuine desire
                  to help his neighbors find the right car at a fair price.
                </p>
                <p>
                  That belief became the foundation for everything that followed. The
                  dealership grew from a single lot into{" "}
                  <strong>{locations.length || 5} locations</strong> across Connecticut,
                  representing Nissan, Infiniti, and Hyundai. George's children carried the
                  business forward, and today, brothers <strong>Tom and Greg Harte</strong>{" "}
                  lead the group as third-generation owners — with the fourth generation
                  already part of the family business.
                </p>
                <p>
                  A lot has changed since 1951. But the way we treat people hasn't. Many of
                  our team members have been with us for <strong>10, 15, even 20+ years</strong>.
                  Customers come back generation after generation — not because we run the
                  flashiest ads, but because when they work with us, they know they'll be
                  treated honestly.
                </p>
                <p>
                  That's why we built <strong>{name}</strong>. We wanted to bring
                  that same family-first philosophy to people who just want to sell their car
                  — quickly, fairly, and without the runaround. You get a real offer in
                  under 2 minutes, backed by an{" "}
                  <strong>{config.price_guarantee_days || 8}-day price guarantee</strong>.
                  We handle the loan payoffs, the paperwork, and we'll even pick up your
                  vehicle for free. It's the kind of experience we'd want for our own family.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Timeline ── */}
        <section className="bg-muted/40 border-y border-border py-14 px-5" aria-label="Company milestones">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-extrabold text-foreground mb-8 text-center">Our Journey</h2>
            <ol className="relative border-l-2 border-primary/20 ml-4 space-y-8">
              {milestones.map((m, i) => (
                <li key={`${m.year}-${i}`} className="pl-8 relative">
                  <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">{m.year}</p>
                  <p className="text-sm text-foreground/80 mt-0.5">{m.label}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Our Values ── */}
        <section className="py-14 md:py-20 px-5" aria-label="Our values">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3 text-center">What We Stand For</h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              These aren't corporate values on a wall. They're the principles we built this business on — and the ones we still live by every day.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((v, i) => {
                const Icon = ICON_MAP[v.icon] || Shield;
                return (
                  <article key={`${v.title}-${i}`} className="bg-card border border-border rounded-xl p-6 flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">{v.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{v.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Locations ── */}
        <section className="bg-muted/40 border-y border-border py-14 px-5" aria-label="Dealership locations">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3 text-center">Come See Us</h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              {locations.length || "Five"} dealerships across Connecticut — all welcoming walk-ins for appraisals and vehicle purchases.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {locations.map((loc) => (
                <article key={loc.id} className="bg-card border border-border rounded-xl p-5 flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{loc.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{loc.city}, {loc.state}</p>
                    {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                  </div>
                </article>
              ))}
              {locations.length === 0 &&
                ["Harte Nissan — Hartford", "Harte Infiniti — Hartford", "George Harte Nissan — West Haven", "George Harte Infiniti — Wallingford", "Harte Hyundai — Old Saybrook"].map((l) => (
                  <div key={l} className="bg-card border border-border rounded-xl p-5 flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{l.split(" — ")[0]}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{l.split(" — ")[1]}, CT</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-14 md:py-20 px-5" aria-label="Get started">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-4">
              Ready to See What Your Car Is Worth?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Get a no-obligation cash offer in under 2 minutes — or give us a call at{" "}
              <a href={`tel:${config.phone || "(860) 506-3092"}`} className="text-primary font-semibold hover:underline">
                {config.phone || "(860) 506-3092"}
              </a>. We'd love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="gap-2">
                <Link to="/" onClick={() => window.scrollTo(0, 0)}>Get Your Offer <ChevronRight className="w-4 h-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/schedule">Schedule a Visit</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default AboutPage;

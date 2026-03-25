import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin, Phone, Clock, Shield, Star, Car,
  Users, Building2, Award, HandshakeIcon, ChevronRight
} from "lucide-react";
import AnimatedCounter from "@/components/AnimatedCounter";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
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

const milestones = [
  { year: "1952", label: "Founded in Hartford, CT" },
  { year: "1970s", label: "Expanded to West Haven & Wallingford" },
  { year: "2010s", label: "Launched digital vehicle purchasing" },
  { year: "2024", label: "14,000+ vehicles purchased from consumers" },
  { year: "2025", label: "Introduced 2-minute instant cash offers" },
];

const values = [
  {
    icon: Shield,
    title: "Transparency",
    text: "Every offer includes a full breakdown — no hidden fees, no surprises. Our disclosure page explains exactly how we value your vehicle.",
  },
  {
    icon: HandshakeIcon,
    title: "No-Pressure Process",
    text: "Our offers are 100% no-obligation with an 8-day price guarantee. Sell when you're ready, not when we say so.",
  },
  {
    icon: Clock,
    title: "Speed & Convenience",
    text: "Get a firm offer in under 2 minutes. We handle loan payoffs, paperwork, and offer free pickup at your door.",
  },
  {
    icon: Award,
    title: "Trust & Reputation",
    text: "4.9-star rating across 2,400+ verified reviews. Family-owned and operated in Connecticut since 1952.",
  },
];

const AboutPage = () => {
  const { config } = useSiteConfig();
  const name = config.dealership_name || "Harte Auto Group";
  const [locations, setLocations] = useState<DealerLocation[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address")
        .eq("is_active", true)
        .order("sort_order");
      if (data) setLocations(data as unknown as DealerLocation[]);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="About Harte Auto Group — CT's Trusted Car Buyer Since 1952"
        description="Family-owned since 1952, Harte Auto Group has purchased 14,700+ vehicles across Connecticut. 4.9-star rating, 2,400+ reviews. Learn about our team, locations, and values."
        path="/about"
      />
      <LocalBusinessJsonLd />
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="bg-primary text-primary-foreground py-16 md:py-24 px-5">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-widest opacity-70 mb-3">
              About Us
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-5">
              Family-Owned. Customer-First.<br className="hidden md:block" /> Since 1952.
            </h1>
            <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Three generations of the Harte family have built one of Connecticut's most
              trusted car-buying services — purchasing over{" "}
              <strong>{config.stats_cars_purchased || "14,721+"}</strong> vehicles
              directly from consumers.
            </p>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="bg-card border-b border-border py-8 px-5" aria-label="Key statistics">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-primary">
                <AnimatedCounter target={parseInt((config.stats_years_in_business || "78").replace(/\D/g, "")) || 78} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Years in Business</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-primary">
                <AnimatedCounter target={parseInt((config.stats_cars_purchased || "14721").replace(/\D/g, "")) || 14721} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Vehicles Purchased</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-primary">{config.stats_rating || "4.9"}</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Average Rating</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-extrabold text-primary">
                <AnimatedCounter target={parseInt((config.stats_reviews_count || "2400").replace(/\D/g, "")) || 2400} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Verified Reviews</p>
            </div>
          </div>
        </section>

        {/* ── Our Story ── */}
        <section className="py-14 md:py-20 px-5" aria-label="Our story">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-6 text-center">
              Our Story
            </h2>
            <div className="prose prose-sm max-w-none text-foreground/85 space-y-4">
              <p>
                In <strong>1952</strong>, the Harte family opened their first dealership in
                Hartford, Connecticut — built on a simple idea: <em>treat every customer
                the way you'd want to be treated</em>. That principle hasn't changed in
                over seven decades.
              </p>
              <p>
                Today, {name} operates <strong>{locations.length || 5} dealership locations</strong>{" "}
                across Connecticut, representing Nissan, Infiniti, and Hyundai. While our
                showrooms sell new and pre-owned vehicles, our{" "}
                <strong>Harte Cash</strong> platform was created to give consumers the
                fastest, most transparent way to sell or trade in their car — without the
                hassle of private-party sales or lowball offers from national competitors.
              </p>
              <p>
                Every offer is generated using <strong>real-time market data</strong> from
                industry-leading valuation sources, adjusted by our proprietary condition
                model, and backed by an{" "}
                <strong>{config.price_guarantee_days || 8}-day price guarantee</strong>.
                We handle loan payoffs, paperwork, and offer{" "}
                <strong>free vehicle pickup</strong> — so you can sell your car without
                leaving your couch.
              </p>
            </div>
          </div>
        </section>

        {/* ── Timeline ── */}
        <section className="bg-muted/40 border-y border-border py-14 px-5" aria-label="Company milestones">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-extrabold text-foreground mb-8 text-center">
              Milestones
            </h2>
            <ol className="relative border-l-2 border-primary/20 ml-4 space-y-8">
              {milestones.map((m) => (
                <li key={m.year} className="pl-8 relative">
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
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-10 text-center">
              What We Stand For
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((v) => (
                <article
                  key={v.title}
                  className="bg-card border border-border rounded-xl p-6 flex gap-4"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <v.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-1">{v.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Locations ── */}
        <section className="bg-muted/40 border-y border-border py-14 px-5" aria-label="Dealership locations">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3 text-center">
              Our Locations
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              Five dealerships across Connecticut — all accepting walk-in appraisals
              and scheduled vehicle purchases.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {locations.map((loc) => (
                <article
                  key={loc.id}
                  className="bg-card border border-border rounded-xl p-5 flex items-start gap-3"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{loc.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {loc.city}, {loc.state}
                    </p>
                    {loc.address && (
                      <p className="text-xs text-muted-foreground">{loc.address}</p>
                    )}
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

        {/* ── Contact + CTA ── */}
        <section className="py-14 md:py-20 px-5" aria-label="Contact and get started">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-4">
              Ready to See What Your Car Is Worth?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Get a no-obligation cash offer in under 2 minutes — or call us at{" "}
              <a href={`tel:${config.phone || "(860) 506-3092"}`} className="text-primary font-semibold hover:underline">
                {config.phone || "(860) 506-3092"}
              </a>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="gap-2">
                <Link to="/">
                  Get Your Offer <ChevronRight className="w-4 h-4" />
                </Link>
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

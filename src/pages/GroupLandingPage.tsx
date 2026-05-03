import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { Building2, Loader2, MapPin } from "lucide-react";

type Rooftop = {
  dealership_id: string;
  display_name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  primary_location_id?: string | null;
};

type Group = {
  id: string;
  name: string;
  display_name: string | null;
  slug: string;
  custom_domain: string | null;
};

/**
 * Group landing chooser.
 *
 * Shown when a customer visits a hostname registered to a dealer_group
 * (via dealer_groups.custom_domain) AND the group has more than one
 * active rooftop. Lists every rooftop with city / state and lets the
 * customer pick which one to start their sell-flow at.
 *
 * For groups with a single rooftop, TenantContext skips this page and
 * resolves directly into that rooftop. For non-group hosts, this page
 * is unreachable.
 *
 * Reachable at /group (route). For prospects who want to bypass, the
 * group's primary rooftop is also accessible directly via its own
 * subdomain or path slug.
 */
const GroupLandingPage = () => {
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [rooftops, setRooftops] = useState<Rooftop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve the group from the current hostname.
        const hostname = window.location.hostname;
        const { data: g, error: gErr } = await supabase
          .from("dealer_groups")
          .select("id, name, display_name, slug, custom_domain")
          .eq("custom_domain", hostname)
          .eq("status", "active")
          .maybeSingle();
        if (cancelled) return;
        if (gErr) throw gErr;
        if (!g) {
          // Not a group host — bounce to home.
          navigate("/", { replace: true });
          return;
        }
        setGroup(g as Group);

        // List every rooftop attached to this group.
        const { data: accounts, error: aErr } = await supabase
          .from("dealer_accounts")
          .select("dealership_id, display_name")
          .eq("dealer_group_id", (g as any).id);
        if (cancelled) return;
        if (aErr) throw aErr;

        const dealershipIds = (accounts ?? []).map((a: any) => a.dealership_id);
        if (dealershipIds.length === 0) {
          setRooftops([]);
          setLoading(false);
          return;
        }

        // Pull tenant + first location per dealership for friendly labels.
        const [{ data: tenants }, { data: locations }] = await Promise.all([
          supabase.from("tenants").select("dealership_id, display_name, slug").in("dealership_id", dealershipIds),
          supabase
            .from("dealership_locations")
            .select("id, dealership_id, name, city, state")
            .in("dealership_id", dealershipIds)
            .order("created_at", { ascending: true }),
        ]);
        if (cancelled) return;

        const byDealership: Map<string, Rooftop> = new Map();
        for (const t of (tenants as any[]) ?? []) {
          byDealership.set(t.dealership_id, {
            dealership_id: t.dealership_id,
            display_name: t.display_name || t.dealership_id,
            slug: t.slug,
          });
        }
        // Attach the first location's city/state when available.
        for (const l of (locations as any[]) ?? []) {
          const r = byDealership.get(l.dealership_id);
          if (r && !r.city) {
            r.city = l.city;
            r.state = l.state;
          }
        }

        // If a rooftop has no tenants row but is in dealer_accounts,
        // fall back to a stub.
        for (const acc of (accounts as any[]) ?? []) {
          if (!byDealership.has(acc.dealership_id)) {
            byDealership.set(acc.dealership_id, {
              dealership_id: acc.dealership_id,
              display_name: acc.display_name || acc.dealership_id,
              slug: acc.dealership_id,
            });
          }
        }

        setRooftops(Array.from(byDealership.values()));
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {error ?? "Couldn't resolve this group."}
          </p>
        </div>
      </div>
    );
  }

  const groupName = group.display_name || group.name;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${groupName} — Pick your store`}
        description={`Get an instant offer on your car at any ${groupName} location.`}
        path="/group"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            {groupName}
          </div>
          <h1 className="text-3xl font-bold text-card-foreground tracking-tight">
            Which store should we send your offer to?
          </h1>
          <p className="text-base text-muted-foreground">
            Pick the closest {groupName} location. Your offer takes 2 minutes
            and is good for 7 days at the store you select.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooftops.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-12">
              No active rooftops in this group right now. Please check back soon.
            </p>
          )}
          {rooftops
            .sort((a, b) => a.display_name.localeCompare(b.display_name))
            .map((r) => (
              <button
                key={r.dealership_id}
                onClick={() => navigate(`/locations/${r.slug}`)}
                className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
                      {r.display_name}
                    </div>
                    {(r.city || r.state) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[r.city, r.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          All {groupName} locations use the same offer engine. Pick the one nearest you for the smoothest pickup or appointment experience.
        </p>
      </div>
    </div>
  );
};

export default GroupLandingPage;

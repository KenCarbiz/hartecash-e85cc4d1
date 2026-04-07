import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Store, TrendingUp, Clock, BarChart3, ChevronDown, Loader2, MapPin, ExternalLink, Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RetailStats {
  mean_days_to_turn: number | null;
  market_days_supply: number | null;
  active: {
    vehicle_count: number;
    minimum_price: number;
    maximum_price: number;
    mean_price: number;
    median_price: number;
    mean_mileage: number;
    median_mileage: number;
  } | null;
  sold: {
    vehicle_count: number;
    minimum_price: number;
    maximum_price: number;
    mean_price: number;
    median_price: number;
    mean_mileage: number;
    median_mileage: number;
  } | null;
}

interface RetailListing {
  listing_id: string;
  vin: string;
  model_year: string;
  make: string;
  model: string;
  series: string;
  style: string;
  price: number;
  mileage: number;
  days_on_market: number;
  dealer_name: string;
  dealer_city: string;
  dealer_state: string;
  distance_to_dealer: number;
  exterior_color: string;
  certified: boolean;
  listing_url: string;
}

interface Props {
  vin?: string;
  uvc?: string;
  zipcode?: string;
  dealerZip?: string;
  radiusMiles?: number;
  offerHigh: number;
}

export default function RetailMarketPanel({ vin, uvc, zipcode, dealerZip, radiusMiles = 100, offerHigh }: Props) {
  const [stats, setStats] = useState<RetailStats | null>(null);
  const [listings, setListings] = useState<RetailListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [radius, setRadius] = useState(radiusMiles);
  const [searchZip, setSearchZip] = useState(dealerZip || zipcode || "");

  useEffect(() => { setRadius(radiusMiles); }, [radiusMiles]);
  useEffect(() => {
    // Default to dealer ZIP, fall back to customer ZIP
    setSearchZip(dealerZip || zipcode || "");
  }, [dealerZip, zipcode]);

  const fetchStats = useCallback(async () => {
    if (!vin && !uvc) return;
    if (!searchZip || searchZip.length < 5) { setError("Valid ZIP code needed for market data"); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("bb-retail-listings", {
        body: { vin, uvc, zipcode: searchZip, radius_miles: radius, include_listings: false },
      });
      if (fnError) throw fnError;
      if (data?.error) { setError(data.error); return; }
      setStats(data.statistics);
      setFetched(true);
    } catch (e) {
      setError((e as Error).message || "Failed to fetch market data");
    } finally {
      setLoading(false);
    }
  }, [vin, uvc, searchZip, radius]);

  const fetchListings = useCallback(async () => {
    if (!vin && !uvc) return;
    if (!searchZip) return;
    setListingsLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("bb-retail-listings", {
        body: { vin, uvc, zipcode: searchZip, radius_miles: radius, include_listings: true },
      });
      if (fnError) throw fnError;
      setListings(data?.listings || []);
      setShowListings(true);
    } catch (e) {
      console.error("Failed to load listings:", e);
    } finally {
      setListingsLoading(false);
    }
  }, [vin, uvc, searchZip, radius]);

  if (!fetched) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Live Market Data
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Search Radius</span>
            <span className="font-semibold text-card-foreground">{radius} mi</span>
          </div>
          <Slider min={25} max={500} step={25} value={[radius]} onValueChange={([v]) => setRadius(v)} className="w-full" />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={fetchStats}
          disabled={loading || (!vin && !uvc) || !zipcode}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <BarChart3 className="w-3.5 h-3.5 mr-1.5" />}
          {loading ? "Fetching market data…" : `Pull Retail Market (${radius}mi)`}
        </Button>
        {error && <p className="text-[10px] text-destructive">{error}</p>}
        {!zipcode && <p className="text-[10px] text-muted-foreground">Customer ZIP code required for market lookup</p>}
      </div>
    );
  }

  if (!stats) return null;

  const active = stats.active;
  const sold = stats.sold;

  // Demand indicator
  const supplyLabel = stats.market_days_supply != null
    ? stats.market_days_supply < 30 ? "High Demand" : stats.market_days_supply < 60 ? "Balanced" : "Oversupplied"
    : null;
  const supplyColor = stats.market_days_supply != null
    ? stats.market_days_supply < 30 ? "text-green-600 dark:text-green-400" : stats.market_days_supply < 60 ? "text-primary" : "text-destructive"
    : "";

  return (
    <div className="space-y-3">
      {/* Header with radius adjuster */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Live Market Data
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{radius}mi</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Slider min={25} max={500} step={25} value={[radius]} onValueChange={([v]) => setRadius(v)} className="flex-1" />
          {radius !== radiusMiles || !fetched ? (
            <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 shrink-0" onClick={() => { setFetched(false); setListings([]); setShowListings(false); setTimeout(fetchStats, 50); }} disabled={loading}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-2">
        {active && (
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Active Listings</div>
            <div className="text-lg font-bold text-card-foreground">{active.vehicle_count}</div>
          </div>
        )}
        {stats.mean_days_to_turn != null && (
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Avg Days to Sell</div>
            <div className="text-lg font-bold text-card-foreground">{Math.round(stats.mean_days_to_turn)}</div>
          </div>
        )}
        {stats.market_days_supply != null && (
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Days Supply</div>
            <div className={`text-lg font-bold ${supplyColor}`}>{Math.round(stats.market_days_supply)}</div>
            {supplyLabel && <div className={`text-[9px] font-semibold ${supplyColor}`}>{supplyLabel}</div>}
          </div>
        )}
      </div>

      {/* Active price stats */}
      {active && active.mean_price > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Asking Prices</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mean</span>
              <span className="font-bold text-card-foreground">${active.mean_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Median</span>
              <span className="font-bold text-card-foreground">${active.median_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Low</span>
              <span className="text-card-foreground">${active.minimum_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">High</span>
              <span className="text-card-foreground">${active.maximum_price.toLocaleString()}</span>
            </div>
          </div>
          {/* Your offer vs market */}
          {offerHigh > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded border border-primary/30 bg-primary/10 text-xs">
              <span className="font-medium text-primary">Your Offer vs Market Median</span>
              <span className={`font-bold ${offerHigh < active.median_price ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {offerHigh < active.median_price ? "-" : "+"}${Math.abs(offerHigh - active.median_price).toLocaleString()}
                <span className="text-[9px] ml-0.5">({Math.round((offerHigh / active.median_price) * 100)}%)</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sold price stats */}
      {sold && sold.mean_price > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recently Sold</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mean</span>
              <span className="font-bold text-card-foreground">${sold.mean_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Median</span>
              <span className="font-bold text-card-foreground">${sold.median_price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sold Count</span>
              <span className="text-card-foreground">{sold.vehicle_count}</span>
            </div>
          </div>
        </div>
      )}

      {/* On-demand listings */}
      <Collapsible open={showListings} onOpenChange={(open) => { if (open && listings.length === 0) fetchListings(); else setShowListings(open); }}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-xs justify-between h-8 px-3">
            <span className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" />
              View Nearby Listings
            </span>
            {listingsLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showListings ? "rotate-180" : ""}`} />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {listings.length === 0 && !listingsLoading && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No active listings found in area.</p>
          )}
          {listings.length > 0 && (
            <div className="space-y-1.5 mt-2 max-h-64 overflow-y-auto pr-1">
              {listings.map((l) => (
                <div key={l.listing_id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs group">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-card-foreground truncate">
                      {l.model_year} {l.make} {l.model} {l.series}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{l.dealer_name}</span>
                      <span>•</span>
                      <span>{l.dealer_city}, {l.dealer_state}</span>
                      <span>•</span>
                      <span>{Math.round(l.distance_to_dealer)}mi</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      {l.mileage > 0 && <span>{l.mileage.toLocaleString()} mi</span>}
                      {l.days_on_market > 0 && <><span>•</span><span>{l.days_on_market}d on market</span></>}
                      {l.exterior_color && <><span>•</span><span>{l.exterior_color}</span></>}
                      {l.certified && <><span>•</span><span className="text-green-600 font-medium">CPO</span></>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-card-foreground">${l.price?.toLocaleString() || "N/A"}</div>
                    {l.listing_url && (
                      <a href={l.listing_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

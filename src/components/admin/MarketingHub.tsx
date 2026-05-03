import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const PromotionManagement = React.lazy(() => import("./PromotionManagement"));
const ReferralManagement = React.lazy(() => import("./ReferralManagement"));
const TestimonialManagement = React.lazy(() => import("./TestimonialManagement"));

interface MarketingHubProps {
  /** Deep-link tab from legacy keys:
   *  "promotions"   → promotions
   *  "referrals"    → referrals
   *  "testimonials" → testimonials
   *  "marketing"    → promotions (default) */
  initialTab?: "promotions" | "referrals" | "testimonials";
}

/**
 * Marketing hub — every customer-acquisition content surface on tabs:
 *
 *   - Promotions   — incentive offers / call-outs (PromotionManagement)
 *   - Referrals    — referral program rules + payouts (ReferralManagement)
 *   - Testimonials — public reviews + curation (TestimonialManagement)
 *
 * Each is small enough on its own that a tab is the right grain. Pulls
 * them out of the long Setup · Process list so a marketing admin sees
 * the full content surface as one destination.
 */
const MarketingHub = ({ initialTab = "promotions" }: MarketingHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Promotions, referrals, and testimonials — your customer-acquisition content.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <PromotionManagement />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="referrals" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <ReferralManagement />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="testimonials" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <TestimonialManagement />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingHub;

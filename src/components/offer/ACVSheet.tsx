import { forwardRef } from "react";
import type { BBVehicle } from "@/components/sell-form/types";
import type { OfferEstimate } from "@/lib/offerCalculator";

interface ACVSheetProps {
  sub: {
    vehicle_year: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vin: string | null;
    mileage: string | null;
    exterior_color: string | null;
    overall_condition: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    appraised_by: string | null;
    appraisal_finalized_at: string | null;
    accidents: string | null;
    drivable: string | null;
    smoked_in: string | null;
    tires_replaced: string | null;
    num_keys: string | null;
    exterior_damage: string[] | null;
    interior_damage: string[] | null;
    windshield_damage: string | null;
    mechanical_issues: string[] | null;
    engine_issues: string[] | null;
    tech_issues: string[] | null;
    tire_lf: number | null;
    tire_rf: number | null;
    tire_lr: number | null;
    tire_rr: number | null;
    brake_lf: number | null;
    brake_rf: number | null;
    brake_lr: number | null;
    brake_rr: number | null;
    tire_adjustment: number | null;
    inspector_grade: string | null;
  };
  bbVehicle: BBVehicle | null;
  offerResult: OfferEstimate | null;
  finalValue: number;
  wholesaleAvg: number;
  tradeinAvg: number;
  retailAvg: number;
  reconCost: number;
  dealerPack: number;
  projectedProfit: number;
  profitMargin: number;
  condition: string;
  dealerName?: string;
  retailMarketData?: {
    activeMean?: number;
    activeMedian?: number;
    activeCount?: number;
    soldMean?: number;
    soldMedian?: number;
    soldCount?: number;
    marketDaysSupply?: number;
    meanDaysToTurn?: number;
  } | null;
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent", very_good: "Very Good", good: "Good", fair: "Fair",
};

const ACVSheet = forwardRef<HTMLDivElement, ACVSheetProps>(({
  sub, bbVehicle, offerResult, finalValue,
  wholesaleAvg, tradeinAvg, retailAvg,
  reconCost, dealerPack, projectedProfit, profitMargin, condition,
  dealerName, retailMarketData,
}, ref) => {
  const privatePartyAvg = Number(bbVehicle?.private_party?.avg || 0);
  const financeAdvAvg = Number(bbVehicle?.finance_advance?.avg || 0);
  const msrp = Number(bbVehicle?.msrp || 0);
  const inventoryCost = finalValue + reconCost + dealerPack;
  const hasTires = !!(sub.tire_lf && sub.tire_rf && sub.tire_lr && sub.tire_rr);
  const avgTireDepth = hasTires ? ((sub.tire_lf! + sub.tire_rf! + sub.tire_lr! + sub.tire_rr!) / 4).toFixed(1) : null;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[8.5in] mx-auto text-sm" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">Actual Cash Value Worksheet</h1>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">INTERNAL — NOT FOR CUSTOMER DISTRIBUTION</p>
          {dealerName && <p className="text-xs font-semibold mt-1">{dealerName}</p>}
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>{dateStr}</div>
          <div>{timeStr}</div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4 text-xs">
        <div className="flex gap-2"><span className="font-bold w-20">Vehicle:</span><span>{sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">VIN:</span><span className="font-mono">{sub.vin || "—"}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">Mileage:</span><span>{sub.mileage ? `${Number(sub.mileage).toLocaleString()} mi` : "—"}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">Color:</span><span>{sub.exterior_color || "—"}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">Style:</span><span>{bbVehicle?.style || "—"}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">Drivetrain:</span><span>{bbVehicle?.drivetrain || "—"}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">Condition:</span><span className="font-bold">{CONDITION_LABELS[condition] || condition}</span></div>
        <div className="flex gap-2"><span className="font-bold w-20">Appraiser:</span><span>{sub.appraised_by || "—"}</span></div>
      </div>

      {/* ACV Summary Box */}
      <div className="border-2 border-black rounded p-4 mb-4">
        <div className="text-center mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Actual Cash Value</div>
          <div className="text-3xl font-black">${finalValue.toLocaleString()}</div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center text-xs border-t border-gray-300 pt-3">
          <div>
            <div className="text-gray-500 uppercase tracking-wider text-[10px]">Recon Cost</div>
            <div className="font-bold text-base">${reconCost.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500 uppercase tracking-wider text-[10px]">Dealer Pack</div>
            <div className="font-bold text-base">${dealerPack.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500 uppercase tracking-wider text-[10px]">Total Inventory Cost</div>
            <div className="font-bold text-base">${inventoryCost.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center text-xs border-t border-gray-300 pt-3 mt-3">
          <div>
            <div className="text-gray-500 uppercase tracking-wider text-[10px]">Projected Profit</div>
            <div className={`font-bold text-base ${projectedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              {projectedProfit >= 0 ? "+" : ""}${projectedProfit.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-500 uppercase tracking-wider text-[10px]">Margin</div>
            <div className={`font-bold text-base ${profitMargin >= 0 ? "text-green-700" : "text-red-700"}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Black Book Values */}
      <div className="mb-4">
        <h2 className="text-xs font-black uppercase tracking-wider border-b border-gray-400 pb-1 mb-2">Black Book Market Values</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 uppercase tracking-wider">
              <th className="py-1">Category</th>
              <th className="py-1 text-right">X-Clean</th>
              <th className="py-1 text-right">Clean</th>
              <th className="py-1 text-right">Average</th>
              <th className="py-1 text-right">Rough</th>
            </tr>
          </thead>
          <tbody>
            {bbVehicle?.retail && (
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold">Retail</td>
                <td className="py-1 text-right">${Number(bbVehicle.retail.xclean || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.retail.clean || 0).toLocaleString()}</td>
                <td className="py-1 text-right font-bold">${Number(bbVehicle.retail.avg || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.retail.rough || 0).toLocaleString()}</td>
              </tr>
            )}
            {bbVehicle?.private_party && (bbVehicle.private_party.avg || 0) > 0 && (
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold">Private Party</td>
                <td className="py-1 text-right">${Number(bbVehicle.private_party.xclean || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.private_party.clean || 0).toLocaleString()}</td>
                <td className="py-1 text-right font-bold">${Number(bbVehicle.private_party.avg || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.private_party.rough || 0).toLocaleString()}</td>
              </tr>
            )}
            {bbVehicle?.tradein && (
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold">Trade-In</td>
                <td className="py-1 text-right">—</td>
                <td className="py-1 text-right">${Number(bbVehicle.tradein.clean || 0).toLocaleString()}</td>
                <td className="py-1 text-right font-bold">${Number(bbVehicle.tradein.avg || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.tradein.rough || 0).toLocaleString()}</td>
              </tr>
            )}
            {bbVehicle?.wholesale && (
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold">Wholesale</td>
                <td className="py-1 text-right">${Number(bbVehicle.wholesale.xclean || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.wholesale.clean || 0).toLocaleString()}</td>
                <td className="py-1 text-right font-bold">${Number(bbVehicle.wholesale.avg || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.wholesale.rough || 0).toLocaleString()}</td>
              </tr>
            )}
            {bbVehicle?.finance_advance && financeAdvAvg > 0 && (
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold">Finance Advance</td>
                <td className="py-1 text-right">${Number(bbVehicle.finance_advance.xclean || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.finance_advance.clean || 0).toLocaleString()}</td>
                <td className="py-1 text-right font-bold">${Number(bbVehicle.finance_advance.avg || 0).toLocaleString()}</td>
                <td className="py-1 text-right">${Number(bbVehicle.finance_advance.rough || 0).toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
        {msrp > 0 && <div className="text-xs mt-1 text-gray-500">Original MSRP: <span className="font-bold text-black">${msrp.toLocaleString()}</span></div>}
      </div>

      {/* Market Scarcity & Live Data */}
      {retailMarketData && (
        <div className="mb-4">
          <h2 className="text-xs font-black uppercase tracking-wider border-b border-gray-400 pb-1 mb-2">Live Market Data</h2>
          <div className="grid grid-cols-4 gap-3 text-xs">
            {retailMarketData.activeCount != null && (
              <div><span className="text-gray-500 block">Active Listings</span><span className="font-bold text-base">{retailMarketData.activeCount}</span></div>
            )}
            {retailMarketData.soldCount != null && (
              <div><span className="text-gray-500 block">Recently Sold</span><span className="font-bold text-base">{retailMarketData.soldCount}</span></div>
            )}
            {retailMarketData.marketDaysSupply != null && (
              <div><span className="text-gray-500 block">Market Days Supply</span><span className="font-bold text-base">{Math.round(retailMarketData.marketDaysSupply)}</span></div>
            )}
            {retailMarketData.meanDaysToTurn != null && (
              <div><span className="text-gray-500 block">Avg Days to Sell</span><span className="font-bold text-base">{Math.round(retailMarketData.meanDaysToTurn)}</span></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
            {retailMarketData.activeMean != null && retailMarketData.activeMean > 0 && (
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">Active Asking Prices</span>
                <span>Mean: <strong>${retailMarketData.activeMean.toLocaleString()}</strong></span>
                {retailMarketData.activeMedian != null && <span className="ml-3">Median: <strong>${retailMarketData.activeMedian.toLocaleString()}</strong></span>}
              </div>
            )}
            {retailMarketData.soldMean != null && retailMarketData.soldMean > 0 && (
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">Sold Prices</span>
                <span>Mean: <strong>${retailMarketData.soldMean.toLocaleString()}</strong></span>
                {retailMarketData.soldMedian != null && <span className="ml-3">Median: <strong>${retailMarketData.soldMedian.toLocaleString()}</strong></span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Residual Values */}
      {bbVehicle && ((bbVehicle.residual_12 || 0) > 0 || (bbVehicle.residual_24 || 0) > 0 || (bbVehicle.residual_36 || 0) > 0) && (
        <div className="mb-4">
          <h2 className="text-xs font-black uppercase tracking-wider border-b border-gray-400 pb-1 mb-2">Residual / Projected Future Values</h2>
          <div className="grid grid-cols-4 gap-3 text-xs">
            {(bbVehicle.residual_12 || 0) > 0 && <div><span className="text-gray-500 block">12-Month</span><span className="font-bold">${Number(bbVehicle.residual_12).toLocaleString()}</span></div>}
            {(bbVehicle.residual_24 || 0) > 0 && <div><span className="text-gray-500 block">24-Month</span><span className="font-bold">${Number(bbVehicle.residual_24).toLocaleString()}</span></div>}
            {(bbVehicle.residual_36 || 0) > 0 && <div><span className="text-gray-500 block">36-Month</span><span className="font-bold">${Number(bbVehicle.residual_36).toLocaleString()}</span></div>}
            {(bbVehicle.residual_48 || 0) > 0 && <div><span className="text-gray-500 block">48-Month</span><span className="font-bold">${Number(bbVehicle.residual_48).toLocaleString()}</span></div>}
          </div>
        </div>
      )}

      {/* Recall Alerts */}
      {bbVehicle && (bbVehicle.recall_count || 0) > 0 && bbVehicle.recalls?.length && (
        <div className="mb-4 border border-red-300 rounded p-2.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-red-700 mb-1">⚠ Open Recalls ({bbVehicle.recall_count})</h2>
          {bbVehicle.recalls.map((r, i) => (
            <div key={i} className="text-[10px] text-gray-700 mb-0.5">
              <strong>{r.component}</strong>{r.campaign_number && ` (${r.campaign_number})`}
              {r.summary && ` — ${r.summary.substring(0, 120)}`}
            </div>
          ))}
        </div>
      )}

      {/* Valuation Factors / Offer Waterfall */}
      {offerResult && (
        <div className="mb-4">
          <h2 className="text-xs font-black uppercase tracking-wider border-b border-gray-400 pb-1 mb-2">Valuation Factors</h2>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1 font-semibold">Base Value (BB)</td>
                <td className="py-1 text-right font-bold">${offerResult.baseValue.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1">Condition Adjustments</td>
                <td className="py-1 text-right">{CONDITION_LABELS[condition] || condition} tier applied</td>
              </tr>
              {offerResult.totalDeductions > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-1">Customer Condition Deductions</td>
                  <td className="py-1 text-right text-red-700 font-bold">-${offerResult.totalDeductions.toLocaleString()}</td>
                </tr>
              )}
              {offerResult.matchedRuleIds.length > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-1">Rule Adjustments</td>
                  <td className="py-1 text-right">{offerResult.matchedRuleIds.length} rule(s) applied</td>
                </tr>
              )}
              {sub.tire_adjustment != null && sub.tire_adjustment !== 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-1">Tire Adjustment</td>
                  <td className={`py-1 text-right font-bold ${Number(sub.tire_adjustment) >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {Number(sub.tire_adjustment) >= 0 ? "+" : ""}${Number(sub.tire_adjustment).toLocaleString()}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-black">
                <td className="py-1 font-black">FINAL ACV</td>
                <td className="py-1 text-right font-black text-lg">${finalValue.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Condition Summary */}
      <div className="mb-4">
        <h2 className="text-xs font-black uppercase tracking-wider border-b border-gray-400 pb-1 mb-2">Vehicle Condition Summary</h2>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
          <div><span className="text-gray-500">Accidents:</span> <span className="font-bold">{sub.accidents || "None"}</span></div>
          <div><span className="text-gray-500">Drivable:</span> <span className="font-bold">{sub.drivable || "Yes"}</span></div>
          <div><span className="text-gray-500">Smoked In:</span> <span className="font-bold">{sub.smoked_in || "No"}</span></div>
          <div><span className="text-gray-500">Windshield:</span> <span className="font-bold">{sub.windshield_damage || "No damage"}</span></div>
          <div><span className="text-gray-500">Keys:</span> <span className="font-bold">{sub.num_keys || "2+"}</span></div>
          <div><span className="text-gray-500">Tires Replaced:</span> <span className="font-bold">{sub.tires_replaced || "—"}</span></div>
          <div><span className="text-gray-500">Exterior Damage:</span> <span className="font-bold">{(sub.exterior_damage || []).filter(d => d !== "none").length || "None"}</span></div>
          <div><span className="text-gray-500">Interior Damage:</span> <span className="font-bold">{(sub.interior_damage || []).filter(d => d !== "none").length || "None"}</span></div>
          <div><span className="text-gray-500">Mechanical Issues:</span> <span className="font-bold">{(sub.mechanical_issues || []).filter(d => d !== "none").length || "None"}</span></div>
          {sub.inspector_grade && <div><span className="text-gray-500">Inspector Grade:</span> <span className="font-bold">{sub.inspector_grade}</span></div>}
          {avgTireDepth && <div><span className="text-gray-500">Avg Tire Depth:</span> <span className="font-bold">{avgTireDepth}/32"</span></div>}
        </div>
      </div>

      {/* Benchmark Summary */}
      <div className="mb-4">
        <h2 className="text-xs font-black uppercase tracking-wider border-b border-gray-400 pb-1 mb-2">Benchmark Comparison</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          <div className="flex justify-between"><span className="text-gray-500">ACV</span><span className="font-bold">${finalValue.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Retail Avg</span><span className="font-bold">${retailAvg.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Trade-In Avg</span><span className="font-bold">${tradeinAvg.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Wholesale Avg</span><span className="font-bold">${wholesaleAvg.toLocaleString()}</span></div>
          {privatePartyAvg > 0 && <div className="flex justify-between"><span className="text-gray-500">Private Party Avg</span><span className="font-bold">${privatePartyAvg.toLocaleString()}</span></div>}
          {financeAdvAvg > 0 && <div className="flex justify-between"><span className="text-gray-500">Finance Advance Avg</span><span className="font-bold">${financeAdvAvg.toLocaleString()}</span></div>}
          {msrp > 0 && <div className="flex justify-between"><span className="text-gray-500">Original MSRP</span><span className="font-bold">${msrp.toLocaleString()}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">ACV vs Retail</span><span className={`font-bold ${finalValue < retailAvg ? "text-green-700" : "text-red-700"}`}>{retailAvg > 0 ? `${((finalValue / retailAvg) * 100).toFixed(0)}%` : "—"}</span></div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-black pt-3 mt-6 flex items-end justify-between text-xs text-gray-400">
        <div>
          <p className="font-bold text-black text-[10px] uppercase">CONFIDENTIAL — INTERNAL USE ONLY</p>
          <p className="text-[9px]">This document is not intended for customer distribution. Values are based on Black Book data and dealer-configured offer logic.</p>
        </div>
        <div className="text-right">
          <div className="border-t border-gray-400 pt-1 w-48 mt-4">
            <span className="text-[10px]">Manager Signature / Date</span>
          </div>
        </div>
      </div>
    </div>
  );
});

ACVSheet.displayName = "ACVSheet";

export default ACVSheet;

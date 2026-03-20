import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, CheckCircle, TrendingUp } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface InspectionDisclosureProps {
  className?: string;
}

const InspectionDisclosure = ({ className }: InspectionDisclosureProps) => {
  const [open, setOpen] = useState(false);
  const { config } = useSiteConfig();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className || "underline decoration-dotted underline-offset-2 hover:text-primary transition-colors cursor-pointer"}
      >
        Offer valid subject to in-person inspection
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Offer Verification & Inspection Disclosure
            </DialogTitle>
            <DialogDescription className="sr-only">Details about how your final offer is determined during in-person inspection</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
            <p>
              Your offer is based on the information you provided online and current market data.
              The <strong>final purchase price</strong> is determined after a brief in-person inspection
              at our dealership, which typically takes 15–20 minutes.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success shrink-0" />
                What We Verify
              </p>
              <ul className="space-y-2 text-muted-foreground ml-6">
                <li className="list-disc">
                  <strong className="text-foreground">Title status</strong> — The title must be clear of
                  any total loss, salvage, flood, frame damage, or other branding events. Title issues
                  may affect your offer.
                </li>
                <li className="list-disc">
                  <strong className="text-foreground">Exterior & interior condition</strong> — We confirm
                  the overall condition matches what was reported. Minor discrepancies are common and
                  usually don't affect the price.
                </li>
                <li className="list-disc">
                  <strong className="text-foreground">Mechanical operation</strong> — A brief test to confirm
                  the vehicle runs and drives as described.
                </li>
              </ul>
            </div>

            <div className="bg-success/5 border border-success/20 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success shrink-0" />
                Your Offer Could Go Up
              </p>
              <p className="text-muted-foreground">
                Vehicles that arrive in <strong className="text-foreground">better condition than reported</strong> may
                qualify for an increased offer at inspection. Specifically:
              </p>
              <ul className="space-y-1.5 text-muted-foreground ml-6">
                <li className="list-disc">
                  <strong className="text-foreground">Tires & brakes</strong> — Vehicles with greater than
                  50–60% remaining tire tread and brake pad life carry additional value that will be
                  assessed during inspection.
                </li>
                <li className="list-disc">
                  <strong className="text-foreground">Recent maintenance</strong> — Up-to-date service records,
                  fresh oil changes, and new filters can positively impact value.
                </li>
                <li className="list-disc">
                  <strong className="text-foreground">Cleanliness & presentation</strong> — A clean, well-maintained
                  vehicle signals care and can support a stronger offer.
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              This offer is not a guarantee of purchase. Final pricing is contingent upon physical verification
              of vehicle condition, mileage, title status, and equipment. Offer valid for{" "}
              {config.price_guarantee_days || 8} days from the date of issuance.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InspectionDisclosure;

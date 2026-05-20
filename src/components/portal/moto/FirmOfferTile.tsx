// Firm Offer tile — the single highest-conversion surface in the
// portal. Matches the MotoAcquire "Your Next Step / Your firm offer
// is ready!" pattern: outer card with a Tag icon top-right, nested
// inner card carrying the dollar amount + expiry + chip row, and a
// big primary CTA that respects the per-tenant `--cta-offer` token
// (yellow on Harte, whatever each tenant configures elsewhere).
//
// The visual lens explicitly rejected MotoAcquire's purple gradient
// — using the tenant CTA preserves dealer-brand identity. The chip
// row uses `Pays Off Loan` (a genuine Hartecash differentiator)
// instead of the generic "Secure & Private" SaaS trope.
import { ArrowRight, ShieldCheck, Tag, Truck, BadgeDollarSign } from "lucide-react";

interface FirmOfferTileProps {
  amount: number;
  dealerName?: string | null;
  expiresAt?: string | null;
  onAccept: () => void;
  acceptLabel?: string;
  ctaIsAccept?: boolean;
  hasAccepted?: boolean;
}

const formatMoney = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

const formatExpiry = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

const FirmOfferTile = ({
  amount,
  dealerName,
  expiresAt,
  onAccept,
  acceptLabel,
  ctaIsAccept = true,
  hasAccepted = false,
}: FirmOfferTileProps) => {
  const expiryLabel = expiresAt ? formatExpiry(expiresAt) : null;
  const ctaText =
    acceptLabel ??
    (hasAccepted ? "View offer details" : ctaIsAccept ? "View Firm Offer" : "Review offer");

  return (
    <article
      aria-labelledby="firm-offer-heading"
      className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-6 lg:p-8 h-full flex flex-col"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55 mb-2">
            {hasAccepted ? "Your Offer" : "Your Next Step"}
          </p>
          <h2
            id="firm-offer-heading"
            className="text-xl lg:text-[22px] font-bold text-foreground leading-[1.2] tracking-tight"
          >
            {hasAccepted ? "Offer accepted." : "Your firm offer is ready!"}
          </h2>
          {dealerName && !hasAccepted ? (
            <p className="text-sm text-foreground/65 mt-1">
              Review your offer from {dealerName}.
            </p>
          ) : null}
        </div>
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "hsl(220 100% 96%)" }}
          aria-hidden="true"
        >
          <Tag className="w-4 h-4 text-primary" strokeWidth={1.75} />
        </div>
      </div>

      {/* Nested inner card carrying the dollar amount. The "card
          inside a card" pattern is what gives the MotoAcquire tile
          its visual heft. */}
      <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-1">
          Firm Offer
        </p>
        <p className="text-[40px] lg:text-[44px] font-bold text-foreground tracking-tight tabular-nums leading-[1.05] mb-2">
          {formatMoney(amount)}
        </p>
        {expiryLabel ? (
          <p className="text-xs text-foreground/55">
            Offer expires {expiryLabel}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-4">
          <Chip icon={<ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />}>
            No Obligation
          </Chip>
          <Chip icon={<Truck className="w-3.5 h-3.5" strokeWidth={1.75} />}>
            Free Pickup
          </Chip>
          <Chip icon={<BadgeDollarSign className="w-3.5 h-3.5" strokeWidth={1.75} />}>
            Pays Off Loan
          </Chip>
        </div>
      </div>

      <button
        type="button"
        onClick={onAccept}
        className="mt-auto w-full h-12 rounded-xl bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)] font-semibold text-base inline-flex items-center justify-center gap-2 hover:opacity-95 active:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--cta-offer))] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      >
        {ctaText}
        <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
      </button>
    </article>
  );
};

const Chip = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground/75">
    <span className="text-foreground/65">{icon}</span>
    {children}
  </span>
);

export default FirmOfferTile;

// Top-bar + content + mobile bottom tab bar shell for the Moto
// customer portal. Per the three-agent panel verdict, Hartecash is
// single-dealer single-vehicle — a full sidebar nav doesn't earn
// its real estate. The shell is a slim header + main content slot
// + a mobile bottom tab bar that surfaces the contextual primary
// action on small viewports.
//
// Token language follows the rest of the Moto system: soft-gray
// page bg `hsl(220 14% 98%)`, white cards with hairline border,
// single navy accent. Tenant CTA tokens flow through via children.
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface PortalShellProps {
  customerFirstName: string | null;
  children: React.ReactNode;
  mobileActionBar?: React.ReactNode;
}

const PortalShell = ({ customerFirstName, children, mobileActionBar }: PortalShellProps) => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim();
  const showDealerName = dealerName && dealerName !== "Our Dealership";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(220 14% 98%)" }}
    >
      {/* Sticky top bar — logo on the left, customer greeting +
          sign-out shortcut on the right. Slim, single hairline
          underneath, no shadow. */}
      <header
        className="sticky top-0 z-40 border-b border-border/60 bg-white/95 backdrop-blur"
        role="banner"
      >
        <div className="max-w-6xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-3 min-w-0"
            aria-label={showDealerName ? `${dealerName} home` : "Home"}
          >
            {config.logo_url ? (
              <img
                src={config.logo_url}
                alt={showDealerName ? dealerName : "Logo"}
                className="h-9 lg:h-10 w-auto object-contain"
              />
            ) : (
              <span className="text-base font-semibold tracking-tight text-foreground truncate">
                {showDealerName ? dealerName : "Customer Portal"}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-5">
            {customerFirstName ? (
              <span className="hidden sm:inline text-sm text-foreground/70">
                Hi, <span className="font-semibold text-foreground">{customerFirstName}</span> 👋
              </span>
            ) : null}
            <Link
              to="/my-submission"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              <span className="hidden sm:inline">Switch vehicle</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </header>

      <main
        className="flex-1 px-5 lg:px-8 py-8 lg:py-12"
        style={{
          // Leave room for the mobile action bar when present so the
          // last card isn't covered by it on small viewports.
          paddingBottom: mobileActionBar ? "calc(env(safe-area-inset-bottom, 0) + 96px)" : undefined,
        }}
      >
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Mobile action bar — fixed bottom strip carrying the
          contextual primary action. Hidden on lg+ where the main
          CTA lives inside the FirmOfferTile / NextStepCard. */}
      {mobileActionBar ? (
        <div
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-white/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
          role="region"
          aria-label="Quick actions"
        >
          <div className="max-w-md mx-auto px-5 py-3">{mobileActionBar}</div>
        </div>
      ) : null}
    </div>
  );
};

export default PortalShell;

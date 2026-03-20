import { Check, X, Minus } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const CompetitorComparison = () => {
  const { config } = useSiteConfig();
  const name = config.dealership_name || "Harte Auto Group";
  const shortName = name.split(" ")[0]; // e.g. "Harte"
  const features = [
    {
      label: "Same-Day Cash Offer",
      harte: true,
      carmax: true,
      carvana: true,
      private: false,
    },
    {
      label: "No Strangers at Your Home",
      harte: true,
      carmax: true,
      carvana: true,
      private: false,
    },
    {
      label: "Top-Dollar Pricing",
      harte: true,
      carmax: "partial",
      carvana: "partial",
      private: true,
    },
    {
      label: "We Handle All Paperwork",
      harte: true,
      carmax: true,
      carvana: true,
      private: false,
    },
    {
      label: "Check on the Spot",
      harte: true,
      carmax: true,
      carvana: false,
      private: "partial",
    },
    {
      label: `${config.price_guarantee_days || 8}-Day Price Guarantee`,
      harte: true,
      carmax: false,
      carvana: false,
      private: false,
    },
    {
      label: "No Lowball Algorithm",
      harte: true,
      carmax: false,
      carvana: false,
      private: true,
    },
    {
      label: "Personal Dealer Experience",
      harte: true,
      carmax: false,
      carvana: false,
      private: false,
    },
  ];

  const CellIcon = ({ value }: { value: boolean | string }) => {
    if (value === true) return <Check className="w-5 h-5 text-success mx-auto" />;
    if (value === "partial") return <Minus className="w-5 h-5 text-muted-foreground mx-auto" />;
    return <X className="w-5 h-5 text-destructive/60 mx-auto" />;
  };

  return (
    <section className="bg-background px-5 py-14" id="compare">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground text-center mb-2">
          Why {shortName} Wins
        </h2>
        <p className="text-center text-muted-foreground mb-8 text-sm">
          See how we stack up against the competition.
        </p>

        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-[40%]">Feature</th>
                  <th className="text-center px-3 py-3 font-bold text-accent w-[15%]">
                    <span className="block text-xs uppercase tracking-wider">{shortName}</span>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-[15%]">
                    <span className="block text-xs uppercase tracking-wider">CarMax</span>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-[15%]">
                    <span className="block text-xs uppercase tracking-wider">Carvana</span>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-[15%]">
                    <span className="block text-xs uppercase tracking-wider">Private</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-card-foreground text-[13px]">{f.label}</td>
                    <td className="px-3 py-3 bg-accent/5"><CellIcon value={f.harte} /></td>
                    <td className="px-3 py-3"><CellIcon value={f.carmax} /></td>
                    <td className="px-3 py-3"><CellIcon value={f.carvana} /></td>
                    <td className="px-3 py-3"><CellIcon value={f.private} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Minus className="w-3 h-3 inline mr-1" /> = Sometimes / Varies
        </p>
      </div>
    </section>
  );
};

export default CompetitorComparison;

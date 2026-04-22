import { CheckCircle, AlertTriangle, ShieldCheck, CalendarCheck, Clock, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import VehicleImage from "@/components/sell-form/VehicleImage";

interface ConditionItem {
  label: string;
  status: "good" | "warn";
}

interface PrintLayoutProps {
  config: {
    logo_url?: string | null;
    logo_white_url?: string | null;
    dealership_name?: string;
    phone?: string | null;
    address?: string | null;
  };
  logoFallback: string;
  submission: {
    name: string | null;
    vehicle_year: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vin: string | null;
    mileage: string | null;
    exterior_color: string | null;
    overall_condition: string | null;
    loan_status: string | null;
  };
  condition: { drivetrain: string | null } | null;
  vehicleStr: string;
  createdDate: Date | null;
  isEstimate: boolean;
  isExpired: boolean;
  daysRemaining: number;
  expiresDate: Date | null;
  activeTab: "sell" | "trade";
  cashOffer: number;
  estimateLow: number;
  tradeInValue: number;
  tradeInValueLow: number;
  taxRate: number;
  taxSavings: number;
  taxPercent: string;
  stateName: string | null;
  conditionItems: ConditionItem[];
  appointment: { preferred_date: string; preferred_time: string; store_location: string | null } | null;
  portalUrl: string;
  getLocationLabel: (loc: string | null) => string | null;
  getLocationAddress: (loc: string | null) => string | null;
}

const OfferPrintLayout = ({
  config,
  logoFallback,
  submission: s,
  condition,
  vehicleStr,
  createdDate,
  isEstimate,
  isExpired,
  daysRemaining,
  expiresDate,
  activeTab,
  cashOffer,
  estimateLow,
  tradeInValue,
  tradeInValueLow,
  taxRate,
  taxSavings,
  taxPercent,
  stateName,
  conditionItems,
  appointment,
  portalUrl,
  getLocationLabel,
  getLocationAddress,
}: PrintLayoutProps) => {
  const printIsTrade = activeTab === "trade";
  const isLeaseBuyout = s.loan_status === "Lease Buyout";
  const printDisplayValue = printIsTrade ? tradeInValue : cashOffer;
  const printDisplayValueLow = printIsTrade ? tradeInValueLow : estimateLow;
  const printDisplayLabel = printIsTrade
    ? "Trade-In Total Value"
    : isLeaseBuyout
    ? "Lease Buyout Cash Offer"
    : "Cash Offer";

  return (
    <div className="hidden print:block print-offer-layout">
      {/* Premium Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b-[3px] border-primary">
        <div className="flex items-center gap-3">
          <img src={config.logo_url || config.logo_white_url || logoFallback} alt={config.dealership_name || "Dealership"} className="h-9 w-auto brightness-0" />
          <div className="border-l-2 border-border pl-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Vehicle Purchase Program</p>
            <p className="text-[9px] text-muted-foreground">
              {createdDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Prepared for</p>
          <p className="text-sm font-bold text-foreground">{s.name || "Customer"}</p>
        </div>
      </div>

      {/* Hero: Vehicle Image + Summary side by side */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          {s.vehicle_year && s.vehicle_make && s.vehicle_model && (
            <div className="overflow-hidden -mx-2">
              <VehicleImage
                year={s.vehicle_year}
                make={s.vehicle_make}
                model={s.vehicle_model}
                selectedColor={s.exterior_color || ""}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-base font-bold text-foreground">{vehicleStr}</p>
            {s.vin && (
              <p className="text-[10px] font-mono text-muted-foreground">VIN: {s.vin.toUpperCase()}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {s.mileage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mileage</span>
                <span className="font-semibold">{Number(s.mileage).toLocaleString()} mi</span>
              </div>
            )}
            {s.exterior_color && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Color</span>
                <span className="font-semibold">{s.exterior_color}</span>
              </div>
            )}
            {condition?.drivetrain && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Powertrain</span>
                <span className="font-semibold capitalize">{condition.drivetrain}</span>
              </div>
            )}
            {s.overall_condition && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Condition</span>
                <span className="font-semibold capitalize">{s.overall_condition}</span>
              </div>
            )}
          </div>

          {/* Offer Card inline */}
          <div className="border-2 border-primary rounded-xl p-3 mt-1">
            <div className="flex justify-center mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] bg-primary/10 text-primary px-3 py-1 rounded-full">
                {printIsTrade ? "Trade-In Offer" : "Cash Offer"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center mb-1">
              {isEstimate ? `Estimated ${printDisplayLabel}` : printDisplayLabel}
            </p>
            {isEstimate ? (
              <p className="text-2xl font-extrabold text-foreground tracking-tight text-center">
                ${printDisplayValueLow.toLocaleString("en-US", { maximumFractionDigits: 0 })} – ${printDisplayValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            ) : (
              <p className="text-2xl font-extrabold text-foreground tracking-tight text-center">
                ${printDisplayValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {isEstimate ? "Preliminary estimate · Final offer after review" : "Subject to in-person inspection"}
            </p>
            {createdDate && !isExpired && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-2 pt-2 border-t border-border">
                <ShieldCheck className="w-3 h-3" />
                Price guaranteed for {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                {expiresDate && <span> · expires {expiresDate.toLocaleDateString()}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Trade-in breakdown (if applicable) */}
      {printIsTrade && taxRate > 0 && (
        <div className="border border-border rounded-lg p-3 mb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 pb-1.5 border-b border-border">Trade-In Tax Credit Breakdown</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash offer value</span>
              <span className="font-medium">${cashOffer.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{stateName} tax credit ({taxPercent}%)</span>
              <span className="font-medium text-success">+${taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border font-bold">
              <span>Total Trade-In Value</span>
              <span>${tradeInValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Condition Report */}
      <div className="border border-border rounded-lg p-3 mb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 pb-1.5 border-b border-border">Condition Report</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {conditionItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              {item.status === "good" ? (
                <CheckCircle className="w-3 h-3 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
              )}
              <span className="capitalize">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Appointment Details (if scheduled) */}
      {appointment && (
        <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-primary/20">
            <CalendarCheck className="w-4 h-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">Scheduled Inspection</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="flex items-start gap-2">
              <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Date</p>
                <p className="font-semibold text-foreground">
                  {new Date(appointment.preferred_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Time</p>
                <p className="font-semibold text-foreground">{appointment.preferred_time}</p>
              </div>
            </div>
            {appointment.store_location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Location</p>
                  <p className="font-semibold text-foreground">{getLocationLabel(appointment.store_location)}</p>
                  {getLocationAddress(appointment.store_location) && (
                    <p className="text-[9px] text-muted-foreground">{getLocationAddress(appointment.store_location)}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* What to Bring + QR */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="border border-border rounded-lg p-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 pb-1.5 border-b border-border">Bring to Your Visit</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>Valid driver's license</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>Vehicle title</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>Current registration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />
              <span>All vehicle keys</span>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-3 flex items-center gap-3 relative">
          <div className="relative shrink-0">
            <QRCodeSVG value={portalUrl} size={60} level="H" />
            <img src={logoFallback} alt="" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-sm bg-white p-0.5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-foreground">Upload Photos</p>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Scan to upload photos & documents to fast-track your deal.
            </p>
          </div>
        </div>
      </div>

      {/* No-VIN Disclaimer */}
      {!s.vin && (
        <div className="border border-warning/40 bg-warning/5 rounded p-2 mb-2 text-center">
          <p className="text-[9px] font-bold text-warning uppercase tracking-wider">⚠ No VIN on File</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">
            This offer was generated without a VIN. All values are subject to vehicle verification. Final offer may change upon VIN confirmation and in-person inspection.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-primary/20 pt-2 flex items-center justify-between text-[9px] text-muted-foreground">
        <p className="font-medium">Offer valid subject to in-person inspection · {config.dealership_name || "Our Dealership"}</p>
        <p>{config.phone}{config.phone && config.address ? " · " : ""}{config.dealership_name}{config.address ? `, ${config.address}` : ""}</p>
      </div>
    </div>
  );
};

export default OfferPrintLayout;

import { useState } from "react";
import { Shield, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = ["Vehicle Info", "Your Details", "Get Offer"];

interface VehicleInfo {
  year: string;
  make: string;
  model: string;
}

const decodeVin = async (vin: string): Promise<VehicleInfo | null> => {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`
    );
    const data = await res.json();
    const results = data.Results as { Variable: string; Value: string | null }[];
    const get = (name: string) =>
      results.find((r) => r.Variable === name)?.Value || "";

    const year = get("Model Year");
    const make = get("Make");
    const model = get("Model");

    if (year && make && model) {
      return { year, make, model };
    }
    return null;
  } catch {
    return null;
  }
};

const SellCarForm = () => {
  const [activeTab, setActiveTab] = useState<"vin" | "plate">("plate");
  const [step, setStep] = useState(0);
  const [vinLoading, setVinLoading] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [vinError, setVinError] = useState("");
  const [formData, setFormData] = useState({
    plate: "",
    state: "",
    vin: "",
    mileage: "",
    name: "",
    phone: "",
    email: "",
    zip: "",
  });

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleVinLookup = async () => {
    const vin = formData.vin.trim();
    if (vin.length !== 17) {
      setVinError("VIN must be exactly 17 characters.");
      return;
    }
    setVinError("");
    setVinLoading(true);
    setVehicleInfo(null);
    const info = await decodeVin(vin);
    setVinLoading(false);
    if (info) {
      setVehicleInfo(info);
    } else {
      setVinError("Could not decode this VIN. Please check and try again.");
    }
  };

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you! We'll reach out with your cash offer shortly.");
  };

  return (
    <div className="bg-card rounded-2xl shadow-xl mx-auto -mt-10 mb-10 p-6 md:p-8 relative z-10 max-w-lg w-[calc(100%-40px)]">
      {/* Progress */}
      <div className="mb-6 pb-5 border-b-2 border-muted">
        <div className="flex justify-center items-center gap-3 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < step
                  ? "bg-success"
                  : i === step
                  ? "bg-accent scale-125"
                  : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground font-medium">
          Step {step + 1} of 3: <strong className="text-card-foreground font-bold">{STEPS[step]}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 0: Vehicle Info */}
        {step === 0 && (
          <>
            <div className="flex gap-2 mb-6 border-b-2 border-muted">
              <button
                type="button"
                onClick={() => { setActiveTab("plate"); setVehicleInfo(null); setVinError(""); }}
                className={`flex-1 py-3 text-[15px] font-semibold border-b-[3px] -mb-[2px] transition-all ${
                  activeTab === "plate"
                    ? "text-accent border-accent"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                License Plate
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vin")}
                className={`flex-1 py-3 text-[15px] font-semibold border-b-[3px] -mb-[2px] transition-all ${
                  activeTab === "vin"
                    ? "text-accent border-accent"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                VIN Number
              </button>
            </div>

            {activeTab === "plate" ? (
              <>
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                    License Plate Number
                  </Label>
                  <Input
                    placeholder="Enter plate number"
                    value={formData.plate}
                    onChange={(e) => update("plate", e.target.value)}
                    className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
                  />
                </div>
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                    State
                  </Label>
                  <Input
                    placeholder="e.g. CT"
                    value={formData.state}
                    onChange={(e) => update("state", e.target.value)}
                    className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                    VIN Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter 17-character VIN"
                      value={formData.vin}
                      onChange={(e) => {
                        update("vin", e.target.value.toUpperCase());
                        setVehicleInfo(null);
                        setVinError("");
                      }}
                      maxLength={17}
                      className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleVinLookup}
                      disabled={vinLoading || formData.vin.trim().length === 0}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 shrink-0"
                    >
                      {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                    </Button>
                  </div>
                  {vinError && (
                    <p className="text-destructive text-sm mt-2">{vinError}</p>
                  )}
                </div>

                {vehicleInfo && (
                  <div className="mb-5 p-4 bg-success/10 border border-success/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="text-sm font-bold text-card-foreground">Vehicle Found</span>
                    </div>
                    <p className="text-base font-semibold text-card-foreground">
                      {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="mb-5">
              <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                Current Mileage
              </Label>
              <Input
                placeholder="e.g. 45,000"
                value={formData.mileage}
                onChange={(e) => update("mileage", e.target.value)}
                className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
              />
            </div>
          </>
        )}

        {/* Step 1: Contact Info */}
        {step === 1 && (
          <>
            <div className="mb-5">
              <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                Full Name
              </Label>
              <Input
                placeholder="John Smith"
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
              />
            </div>
            <div className="mb-5">
              <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                Phone Number
              </Label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
              />
            </div>
            <div className="mb-5">
              <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                Email Address
              </Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => update("email", e.target.value)}
                className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
              />
            </div>
            <div className="mb-5">
              <Label className="text-sm font-semibold text-card-foreground mb-2 block">
                ZIP Code
              </Label>
              <Input
                placeholder="06001"
                value={formData.zip}
                onChange={(e) => update("zip", e.target.value)}
                className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
              />
            </div>
          </>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🚗</div>
            <h3 className="text-xl font-bold text-card-foreground mb-2">
              Ready to Get Your Offer!
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Click below and we'll have your personalized cash offer ready in minutes.
            </p>
            {vehicleInfo && (
              <p className="text-base font-semibold text-card-foreground mb-4">
                {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="flex-1 py-4 text-base font-bold"
            >
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30 hover:-translate-y-0.5 transition-all"
            >
              Continue
            </Button>
          ) : (
            <Button
              type="submit"
              className="flex-1 py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30 hover:-translate-y-0.5 transition-all"
            >
              Get My Cash Offer →
            </Button>
          )}
        </div>
      </form>

      <p className="text-center mt-4 text-[13px] text-muted-foreground">
        🔒 Your information is 100% secure and never shared.
      </p>

      {/* Guarantee Badge */}
      <div className="bg-gradient-to-br from-success to-[hsl(160,84%,30%)] text-success-foreground p-5 rounded-xl mt-6 text-center shadow-lg shadow-success/30">
        <Shield className="w-8 h-8 mx-auto mb-2" />
        <h4 className="text-lg font-extrabold tracking-wide mb-2">
          8-DAY PRICE GUARANTEE
        </h4>
        <p className="text-sm leading-relaxed opacity-95">
          Your offer is good for 7 days. No games. No surprises.
        </p>
      </div>
    </div>
  );
};

export default SellCarForm;

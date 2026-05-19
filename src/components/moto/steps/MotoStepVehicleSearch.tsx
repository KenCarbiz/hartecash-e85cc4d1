import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import { MotoOutlinedInput, MotoOutlinedSelect } from "../MotoOutlinedField";
import type { LookupMode, MotoFlowState } from "../types";
import type { BBVehicle } from "@/components/sell-form/types";
import { fetchModelsForMakeYear, MAKE_OPTIONS, YEAR_OPTIONS } from "../ymmData";
import { cn } from "@/lib/utils";
import tenantHeroVehicle from "@/assets/tenant-hero-vehicle.webp";
import { useHeroTuner } from "../HeroTuner";
import { useTunerConfig } from "../useTunerConfig";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
].map((s) => ({ value: s, label: s }));

const TABS: { id: Exclude<LookupMode, "ymm">; label: string }[] = [
  { id: "vin", label: "Vehicle Search" },
  { id: "plate", label: "License Plate" },
];

const MotoStepVehicleSearch = ({
  state,
  onResolved,
}: {
  state: MotoFlowState;
  onResolved: (next: Partial<MotoFlowState>) => void;
}) => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const tuner = useHeroTuner();


  const [tab, setTab] = useState<Exclude<LookupMode, "ymm">>(
    state.lookupMode === "plate" ? "plate" : "vin",
  );
  const [year, setYear] = useState(state.ymm.year);
  const [make, setMake] = useState(state.ymm.make);
  const [model, setModel] = useState(state.ymm.model);
  const [trim, setTrim] = useState(state.ymm.trim);
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [vin, setVin] = useState(state.vin);
  const [plate, setPlate] = useState(state.plate);
  const [plateState, setPlateState] = useState(state.plateState || "");
  const [loading, setLoading] = useState(false);

  // Load model options whenever Year + Make change.
  useEffect(() => {
    let cancelled = false;
    if (!year || !make) {
      setModelOptions([]);
      return;
    }
    setModelsLoading(true);
    fetchModelsForMakeYear(make, year).then((opts) => {
      if (cancelled) return;
      setModelOptions(opts);
      setModelsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [year, make]);

  const vinClean = vin.trim().toUpperCase();
  const plateClean = plate.trim().toUpperCase();

  const ymmReady = !!year && !!make && !!model;
  const vinReady = vinClean.length === 17;
  const plateReady = plateClean.length >= 2 && !!plateState;
  const canSubmit = tab === "vin" ? vinReady || ymmReady : plateReady;

  const submit = async () => {
    setLoading(true);
    try {
      if (tab === "vin" && vinReady) {
        const { data, error } = await supabase.functions.invoke("bb-lookup", {
          body: { lookup_type: "vin", vin: vinClean, dealership_id: dealershipId },
        });
        if (error || data?.error || !data?.vehicles?.length) {
          toast({
            title: "Couldn't decode that VIN",
            description: "Double-check the VIN or use Year / Make / Model.",
            variant: "destructive",
          });
          return;
        }
        const bb = data.vehicles[0] as BBVehicle;
        onResolved({ lookupMode: "vin", vin: vinClean, bbVehicle: bb, step: "condition" });
        return;
      }

      if (tab === "vin" && ymmReady) {
        const stub: BBVehicle = {
          uvc: "", vin: "",
          year, make, model, series: trim, style: "", class_name: "",
          msrp: 0, price_includes: "",
          drivetrain: "", transmission: "", engine: "", fuel_type: "",
          exterior_colors: [],
          mileage_adj: 0, regional_adj: 0, base_whole_avg: 0,
          add_deduct_list: [],
          wholesale: { xclean: 0, clean: 0, avg: 0, rough: 0 },
          tradein: { clean: 0, avg: 0, rough: 0 },
          retail: { xclean: 0, clean: 0, avg: 0, rough: 0 },
          _nhtsa: true,
        };
        onResolved({
          lookupMode: "ymm",
          ymm: { year, make, model, trim },
          bbVehicle: stub,
          step: "condition",
        });
        return;
      }

      if (tab === "plate") {
        const { data, error } = await supabase.functions.invoke("bb-lookup", {
          body: { lookup_type: "plate", plate: plateClean, state: plateState, dealership_id: dealershipId },
        });
        if (error || data?.error || !data?.vehicles?.length) {
          toast({
            title: "Plate lookup unavailable",
            description: "Try VIN or Year / Make / Model.",
            variant: "destructive",
          });
          return;
        }
        const bb = data.vehicles[0] as BBVehicle;
        onResolved({
          lookupMode: "plate",
          plate: plateClean,
          plateState,
          vin: bb.vin || "",
          bbVehicle: bb,
          step: "condition",
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Break out of MotoShell's max-w-screen-sm so the hero can fill
          the viewport. Card stays max-w-md on the left, vehicle image
          gets all remaining width on the right. */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-6 lg:px-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex w-full flex-col items-center justify-center gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
            {/* Left column: heading + card stay locked-aligned to the
                same left edge regardless of image width/gap. */}
            <div className="w-full max-w-lg flex-shrink-0">
              <h1
                className="whitespace-nowrap leading-[1.05] tracking-tight"
                style={{
                  fontSize: `${tuner.size}px`,
                  fontWeight: tuner.weight,
                  color: tuner.color,
                  fontFamily: tuner.font,
                  marginTop: `${4 + tuner.offsetY}px`,
                }}
              >
                <span style={{ color: tuner.accentColor, fontWeight: tuner.accentWeight }}>
                  Get an
                </span>{" "}
                <span style={{ color: tuner.instantColor, fontWeight: tuner.instantWeight }}>
                  Instant
                </span>{" "}
                <span style={{ color: tuner.accentColor, fontWeight: tuner.accentWeight }}>
                  Vehicle Valuation
                </span>
              </h1>
              <p
                className="mt-3 whitespace-nowrap"
                style={{
                  fontSize: `${tuner.subSize}px`,
                  color: tuner.subColor,
                  fontFamily: tuner.font,
                }}
              >
                Get an instant valuation &amp; then add more info to get a firm offer.
              </p>
              <div style={{ marginTop: `${tuner.subGap}px` }}>
              <MotoCard className="p-6">
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1 text-sm font-semibold">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "rounded-md px-3 transition",
                      active ? "shadow-sm" : "text-zinc-700 hover:text-zinc-900",
                    )}
                    style={{
                      paddingTop: `${tuner.tabPadY}px`,
                      paddingBottom: `${tuner.tabPadY}px`,
                      ...(active
                        ? { background: tuner.ctaColor, color: tuner.ctaTextColor }
                        : {}),
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>


            {tab === "vin" && (
              <div className="space-y-4">
                <MotoOutlinedSelect
                  label="Vehicle Year"
                  placeholder="Vehicle Year"
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setMake("");
                    setModel("");
                    setTrim("");
                  }}
                  options={YEAR_OPTIONS}
                />
                {year && (
                  <MotoOutlinedSelect
                    label="Vehicle Make"
                    value={make}
                    onChange={(e) => {
                      setMake(e.target.value);
                      setModel("");
                      setTrim("");
                    }}
                    options={MAKE_OPTIONS}
                  />
                )}
                {year && make && (
                  <MotoOutlinedSelect
                    label={modelsLoading ? "Vehicle Model (loading…)" : "Vehicle Model"}
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value);
                      setTrim("");
                    }}
                    options={modelOptions}
                    disabled={modelsLoading || modelOptions.length === 0}
                  />
                )}
                {year && make && model && (
                  <MotoOutlinedInput
                    label="Vehicle Trim"
                    value={trim}
                    onChange={(e) => setTrim(e.target.value)}
                    placeholder="e.g. EX-L, Sport, Premium Luxury"
                  />
                )}
                <div className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  OR
                </div>
                <MotoOutlinedInput
                  label="VIN"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  maxLength={17}
                  autoComplete="off"
                  placeholder="VIN"
                />
              </div>
            )}

            {tab === "plate" && (
              <div className="grid grid-cols-2 gap-3">
                <MotoOutlinedInput
                  label="License Plate*"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  autoComplete="off"
                />
                <MotoOutlinedSelect
                  label="State*"
                  value={plateState}
                  onChange={(e) => setPlateState(e.target.value)}
                  options={US_STATES}
                />
              </div>
            )}


            <div className="mt-8">
              <MotoPrimaryButton
                className="w-full py-2 rounded-full text-sm bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                onClick={submit}
                disabled={!canSubmit}
                loading={loading}
              >
                Next
              </MotoPrimaryButton>
            </div>
              </MotoCard>
              </div>

              <div
                className="mt-4 rounded-md py-3 text-center text-sm font-semibold"
                style={{ background: tuner.ctaColor, color: tuner.ctaTextColor }}
              >
                Get a valuation in less than 30 seconds!
              </div>
            </div>

            <HeroVehicleTuner src={tenantHeroVehicle} />
          </div>
        </div>
      </div>
    </>
  );
};

// ----- Dev tuner for hero vehicle (width + gap from card, per breakpoint) -----
type BP = "base" | "sm" | "md" | "lg" | "xl" | "2xl";
const BP_MIN: Record<BP, number> = { base: 0, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };
const BP_ORDER: BP[] = ["base", "sm", "md", "lg", "xl", "2xl"];
const TUNER_DEFAULTS: Record<BP, { w: number; gap: number }> = {
  base: { w: 420, gap: 0 },
  sm: { w: 520, gap: 0 },
  md: { w: 620, gap: 0 },
  lg: { w: 680, gap: 0 },
  xl: { w: 780, gap: 0 },
  "2xl": { w: 880, gap: 0 },
};
const TUNER_STORAGE_KEY = "heroVehicleTuner.v1";

const useCurrentBreakpoint = (): BP => {
  const [bp, setBp] = useState<BP>("base");
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      let current: BP = "base";
      for (const b of BP_ORDER) if (w >= BP_MIN[b]) current = b;
      setBp(current);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return bp;
};

const HeroVehicleTuner = ({ src }: { src: string }) => {
  const bp = useCurrentBreakpoint();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const { tenant } = useTenant();
  const { config, update, status, realtime, lastUpdatedAt } = useTunerConfig(tenant.dealership_id);
  const remote = (config.vehicle ?? {}) as Partial<Record<BP, { w: number; gap: number }>>;
  const settings: Record<BP, { w: number; gap: number }> = {
    ...TUNER_DEFAULTS,
    ...remote,
  };
  const setSettings = (
    updater:
      | Record<BP, { w: number; gap: number }>
      | ((s: Record<BP, { w: number; gap: number }>) => Record<BP, { w: number; gap: number }>),
  ) => {
    const next = typeof updater === "function" ? (updater as Function)(settings) : updater;
    update("vehicle", next as unknown as Record<string, unknown>);
  };
  const [open, setOpen] = useState(false);


  const { w, gap } = settings[bp];
  const updateBp = (key: "w" | "gap", value: number) =>
    setSettings((s) => {
      if (key === "w") {
        const currentWidth = s[bp]?.w || value;
        const ratio = currentWidth > 0 ? value / currentWidth : 1;
        return BP_ORDER.reduce((next, breakpoint) => {
          const existing = s[breakpoint] ?? TUNER_DEFAULTS[breakpoint];
          const scaledWidth = breakpoint === bp ? value : Math.round((existing.w * ratio) / 10) * 10;
          next[breakpoint] = {
            ...existing,
            w: Math.min(1800, Math.max(120, scaledWidth)),
          };
          return next;
        }, {} as Record<BP, { w: number; gap: number }>);
      }

      return BP_ORDER.reduce((next, breakpoint) => {
        const existing = s[breakpoint] ?? TUNER_DEFAULTS[breakpoint];
        next[breakpoint] = { ...existing, gap: value };
        return next;
      }, {} as Record<BP, { w: number; gap: number }>);
    });


  return (
    <>
      <div
        className="flex flex-none items-center justify-center overflow-visible xl:justify-start"
        style={{ marginLeft: gap, width: w, maxWidth: "none" }}
      >
        <img
          src={src}
          alt="Featured vehicle"
          className="h-auto max-w-none object-contain"
          style={{ width: w, minWidth: w }}
          loading="eager"
        />
      </div>

      {isPlatformAdmin && <div className="fixed bottom-4 right-4 z-50">
        {open ? (
          <div className="w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  Vehicle Tuner · <span className="text-[hsl(var(--cta-offer))]">{bp}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      realtime === "live" && "animate-pulse bg-emerald-500",
                      realtime === "connecting" && "bg-amber-400",
                      realtime === "error" && "bg-red-500",
                      realtime === "closed" && "bg-zinc-400",
                    )}
                  />
                  <span>{realtime}</span>
                  <span className="text-zinc-300">·</span>
                  <span>{status}</span>
                  <span className="text-zinc-300">·</span>
                  <span>
                    {lastUpdatedAt
                      ? new Date(lastUpdatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">×</button>
            </div>
            <label className="block text-xs font-medium text-zinc-600">
              Image width: <span className="font-mono">{w}px</span>
            </label>
            <input
              type="range" min={120} max={1800} step={10}
              value={w}
              onChange={(e) => updateBp("w", Number(e.target.value))}
              className="mb-3 w-full"
            />
            <label className="block text-xs font-medium text-zinc-600">
              Gap from card: <span className="font-mono">{gap}px</span>
              <span className="ml-1 text-zinc-400">(negative = closer)</span>
            </label>
            <input
              type="range" min={-400} max={400} step={4}
              value={gap}
              onChange={(e) => updateBp("gap", Number(e.target.value))}
              className="mb-3 w-full"
            />
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, [bp]: TUNER_DEFAULTS[bp] }))}
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Reset {bp}
            </button>
            <div className="mt-2 text-[10px] leading-snug text-zinc-400">
              Saves to the live site and keeps desktop sizes in sync.
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-zinc-800"
          >
            🚗 Tune ({bp})
          </button>
        )}
      </div>
    </>
  );
};

export default MotoStepVehicleSearch;

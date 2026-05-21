import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Home, Building2, MapPin, Check, AlertTriangle, Lock, Star,
  Navigation, Trash2, Pencil, Plus, Shield, Truck, Clock, Sparkles,
  Locate, CheckCircle2,
} from "lucide-react";
import { SlideOver } from "./SlideOver";
import { PrimaryButton, SecondaryButton, SectionLabel, StatusPill } from "./PortalPageShell";
import { PORTAL_MOCK as MOCK } from "./portalMock";

/* ───────────────────────── Types ───────────────────────── */

export type AddressType = "home" | "work" | "other";
export type TransactionStage =
  | "pre_schedule" | "scheduled" | "driver_assigned" | "in_transit" | "complete";

export type PickupLocation = {
  id: string;
  type: AddressType;
  nickname: string;
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  instructions?: string;
  isDefault?: boolean;
  verified?: boolean;
};

export type MailingAddress = {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
};

/* ───────────────────────── Atoms ───────────────────────── */

const FIELD =
  "mt-1 w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm text-[#06194A] placeholder:text-[#8893A8] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 outline-none transition";

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{children}</span>
);

const Field = ({
  label, value, onChange, placeholder, className = "",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => (
  <label className={`block ${className}`}>
    <Label>{label}</Label>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={FIELD} />
  </label>
);

export const ADDRESS_ICONS: Record<AddressType, React.ComponentType<{ className?: string }>> = {
  home: Home, work: Building2, other: MapPin,
};

export const ADDRESS_LABELS: Record<AddressType, string> = {
  home: "Home", work: "Work", other: "Other",
};

/* ───────────────────────── Mini Map Preview ─────────────────────────
   Lightweight non-API SVG that fakes a street grid + drop pin. Animates
   when ZIP/city changes so the user sees the system "react" to typing. */

const MapPreview = ({ seed, verified }: { seed: string; verified: boolean }) => {
  const offset = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return { x: 40 + (h % 60), y: 40 + ((h >> 4) % 50) };
  }, [seed]);

  return (
    <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-[#E6EAF0] bg-gradient-to-br from-[#EEF0FF] via-[#F7F8FB] to-[#EEF0FF]">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 140" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M14 0H0V14" fill="none" stroke="#C7D2FE" strokeWidth="0.5" opacity="0.55" />
          </pattern>
        </defs>
        <rect width="200" height="140" fill="url(#grid)" />
        <path d="M0,72 Q60,68 120,80 T200,76" stroke="#A5B4FC" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M70,0 L74,140" stroke="#A5B4FC" strokeWidth="1.5" fill="none" opacity="0.55" />
      </svg>
      <motion.div
        key={`${offset.x}-${offset.y}`}
        initial={{ opacity: 0, y: -6, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 22 }}
        className="absolute"
        style={{ left: `${offset.x}%`, top: `${offset.y}%`, transform: "translate(-50%, -100%)" }}
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] grid place-items-center shadow-[0_10px_24px_-8px_rgba(79,70,229,0.65)] ring-4 ring-white/70">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#4F46E5]/30 blur-[2px]" />
        </div>
      </motion.div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/85 backdrop-blur px-2.5 py-1 text-[10.5px] font-semibold text-[#06194A] border border-white">
          <Navigation className="w-3 h-3 text-[#4F46E5]" />
          Live preview
        </div>
        {verified ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F8EE] px-2.5 py-1 text-[10.5px] font-semibold text-[#0F7A3E] border border-[#BBF0CC]">
            <Check className="w-3 h-3" /> Verified
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-2.5 py-1 text-[10.5px] font-semibold text-[#B45309] border border-[#FCD9A8]">
            <AlertTriangle className="w-3 h-3" /> Checking…
          </div>
        )}
      </div>
    </div>
  );
};

/* ───────────────────────── Stage Lock Banner ───────────────────────── */

const STAGE_NOTICE: Record<TransactionStage, null | { tone: "indigo" | "orange" | "red"; Icon: any; text: string }> = {
  pre_schedule: null,
  scheduled: { tone: "indigo", Icon: Clock, text: "Changing your pickup location may affect scheduling availability." },
  driver_assigned: { tone: "orange", Icon: Truck, text: "Pickup location updates may require transport reassignment." },
  in_transit: { tone: "red", Icon: Lock, text: "Pickup location can no longer be modified after transport begins." },
  complete: { tone: "red", Icon: Lock, text: "This transaction is complete. Pickup details are locked." },
};

const StageBanner = ({ stage }: { stage: TransactionStage }) => {
  const n = STAGE_NOTICE[stage];
  if (!n) return null;
  const palette: Record<string, string> = {
    indigo: "bg-[#EEF0FF] border-[#C7D2FE]/60 text-[#4338CA]",
    orange: "bg-[#FEF3E2] border-[#FCD9A8] text-[#B45309]",
    red:    "bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${palette[n.tone]}`}>
      <n.Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{n.text}</span>
    </div>
  );
};

/* ───────────────────────── Workflow Intelligence Toasts ───────────────────────── */

const WORKFLOW_EVENTS = [
  { icon: "🚚", text: "Transport availability updated" },
  { icon: "📍", text: "Pickup ETA recalculated" },
  { icon: "⚡", text: "Route optimized" },
  { icon: "🏢", text: "Nearby dealership availability refreshed" },
];

const fireWorkflowIntelligence = () => {
  WORKFLOW_EVENTS.forEach((e, i) => {
    setTimeout(() => toast(`${e.icon}  ${e.text}`, { duration: 2400 }), 500 + i * 700);
  });
};

/* ═══════════════════════ PROFILE DRAWER ═══════════════════════ */

export const ProfileDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [first, setFirst] = useState(MOCK.customer.firstName);
  const [last, setLast] = useState(MOCK.customer.lastName);
  const [email, setEmail] = useState(MOCK.customer.email);
  const [phone, setPhone] = useState(MOCK.customer.phone);
  const [addr, setAddr] = useState<MailingAddress>(MOCK.customer.mailingAddress);

  const save = () => {
    toast.success("Profile updated successfully");
    onClose();
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Profile"
      subtitle="Your identity and mailing address"
      width="lg"
      footer={
        <div className="flex gap-2">
          <SecondaryButton onClick={onClose} className="flex-1">Cancel</SecondaryButton>
          <PrimaryButton onClick={save} className="flex-1">Save Changes</PrimaryButton>
        </div>
      }
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center text-lg font-bold ring-1 ring-[#C7D2FE]/60">
          {MOCK.customer.initials}
        </div>
        <div>
          <div className="text-sm font-semibold text-[#06194A]">{first} {last}</div>
          <button className="text-xs font-semibold text-[#4F46E5] hover:underline mt-0.5">Change avatar</button>
        </div>
      </div>

      <SectionLabel>Personal</SectionLabel>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="First name" value={first} onChange={setFirst} />
        <Field label="Last name" value={last} onChange={setLast} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="(555) 555-5555" />
      </div>

      <div className="mt-6">
        <SectionLabel>Mailing address</SectionLabel>
        <p className="text-[11.5px] text-[#8893A8] mt-1">Where we send payment confirmations and tax documents.</p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <Field label="Street" value={addr.street} onChange={(v) => setAddr({ ...addr, street: v })} />
        <Field label="Apt / Unit" value={addr.unit ?? ""} onChange={(v) => setAddr({ ...addr, unit: v })} placeholder="Optional" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="State" value={addr.state} onChange={(v) => setAddr({ ...addr, state: v })} />
            <Field label="ZIP" value={addr.zip} onChange={(v) => setAddr({ ...addr, zip: v })} />
          </div>
        </div>
      </div>
    </SlideOver>
  );
};

/* ═══════════════════════ PICKUP ADDRESS DRAWER ═══════════════════════
   Edits / creates a single pickup location with map + verification + notes. */

export const PickupAddressDrawer = ({
  open, onClose, location, stage, onSave, onDelete,
}: {
  open: boolean;
  onClose: () => void;
  location: PickupLocation | null;          // null = create new
  stage: TransactionStage;
  onSave: (loc: PickupLocation) => void;
  onDelete?: (id: string) => void;
}) => {
  const isLocked = stage === "in_transit" || stage === "complete";

  const empty: PickupLocation = {
    id: "", type: "home", nickname: "", street: "", unit: "",
    city: "", state: "", zip: "", instructions: "", isDefault: false, verified: false,
  };
  const [loc, setLoc] = useState<PickupLocation>(location ?? empty);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(location?.verified ?? false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Reset state when drawer opens with new target.
  useEffect(() => {
    if (open) {
      setLoc(location ?? empty);
      setVerified(location?.verified ?? false);
      setSuggestion(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location?.id]);

  // Debounced "USPS-style" verification simulation on ZIP/city change.
  useEffect(() => {
    if (!loc.street || !loc.zip || loc.zip.length < 5) {
      setVerified(false);
      setSuggestion(null);
      return;
    }
    setVerifying(true);
    setVerified(false);
    const t = setTimeout(() => {
      setVerifying(false);
      // Deterministic faux suggestion if street ends in lowercase "ave" / "st"
      const looksFuzzy = /(\bave\b|\bst\b|\brd\b)$/i.test(loc.street.trim()) && /[a-z]/.test(loc.street.slice(-3));
      if (looksFuzzy && Math.random() > 0.6) {
        setSuggestion(loc.street.replace(/\bave\b/i, "Avenue").replace(/\bst\b/i, "Street").replace(/\brd\b/i, "Road"));
        setVerified(false);
      } else {
        setSuggestion(null);
        setVerified(true);
      }
    }, 750);
    return () => clearTimeout(t);
  }, [loc.street, loc.city, loc.state, loc.zip]);

  const save = () => {
    if (isLocked) return;
    if (!loc.street || !loc.city || !loc.state || loc.zip.length < 5) {
      toast.error("Please complete the street, city, state and ZIP.");
      return;
    }
    const finalLoc: PickupLocation = {
      ...loc,
      id: loc.id || `loc_${Date.now()}`,
      nickname: loc.nickname || ADDRESS_LABELS[loc.type],
      verified,
    };
    onSave(finalLoc);
    toast.success("✅ Pickup location verified and saved");
    fireWorkflowIntelligence();
    onClose();
  };

  const useCurrentLocation = () => {
    toast("📍 Locating you…");
    setTimeout(() => {
      setLoc((l) => ({ ...l, street: "248 Brookline Ave", city: "Boston", state: "MA", zip: "02215" }));
      toast.success("Current location detected");
    }, 900);
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={location ? "Edit Pickup Location" : "Add Pickup Location"}
      subtitle={location ? loc.nickname || ADDRESS_LABELS[loc.type] : "Where should we collect the vehicle?"}
      width="lg"
      footer={
        <div className="flex gap-2">
          <SecondaryButton onClick={onClose} className="flex-1">Cancel</SecondaryButton>
          <PrimaryButton onClick={save} className="flex-1">
            {isLocked ? "Locked" : "Save Location"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-5">
        <StageBanner stage={stage} />

        <MapPreview seed={`${loc.street}${loc.zip}`} verified={verified && !verifying} />

        {/* Type selector */}
        <div>
          <SectionLabel>Location type</SectionLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["home", "work", "other"] as AddressType[]).map((t) => {
              const Icon = ADDRESS_ICONS[t];
              const active = loc.type === t;
              return (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.97 }}
                  disabled={isLocked}
                  onClick={() => setLoc({ ...loc, type: t })}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[12px] font-semibold transition ${
                    active
                      ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4338CA] shadow-[0_8px_20px_-12px_rgba(79,70,229,0.45)]"
                      : "border-[#E6EAF0] text-[#53627A] hover:border-[#4F46E5]/40 hover:text-[#4F46E5]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {ADDRESS_LABELS[t]}
                </motion.button>
              );
            })}
          </div>
        </div>

        <Field
          label="Location nickname"
          value={loc.nickname}
          onChange={(v) => setLoc({ ...loc, nickname: v })}
          placeholder="e.g. Home Garage, Office Parking Lot"
        />

        {/* Address form */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Address</SectionLabel>
            <button
              onClick={useCurrentLocation}
              disabled={isLocked}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#4F46E5] hover:underline disabled:opacity-40"
            >
              <Locate className="w-3.5 h-3.5" />
              Use current location
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Street" value={loc.street} onChange={(v) => setLoc({ ...loc, street: v })} placeholder="123 Main Street" />
            <Field label="Apt / Unit" value={loc.unit ?? ""} onChange={(v) => setLoc({ ...loc, unit: v })} placeholder="Optional" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={loc.city} onChange={(v) => setLoc({ ...loc, city: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="State" value={loc.state} onChange={(v) => setLoc({ ...loc, state: v })} placeholder="MA" />
                <Field label="ZIP" value={loc.zip} onChange={(v) => setLoc({ ...loc, zip: v })} placeholder="02215" />
              </div>
            </div>
          </div>
        </div>

        {/* Verification indicator */}
        <AnimatePresence mode="wait">
          {verifying && (
            <motion.div key="ver" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[12px] text-[#4F46E5] font-medium">
              <span className="w-3 h-3 rounded-full border-2 border-[#C7D2FE] border-t-[#4F46E5] animate-spin" />
              Verifying address…
            </motion.div>
          )}
          {!verifying && suggestion && (
            <motion.div key="sugg" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl bg-[#FEF3E2] border border-[#FCD9A8] p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#B45309] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-[#7C4A0F]">Suggested correction</div>
                <div className="text-[12px] text-[#7C4A0F]/85 mt-0.5">
                  Use "<span className="font-semibold">{suggestion}</span>" instead?
                </div>
                <button
                  onClick={() => { setLoc({ ...loc, street: suggestion }); setSuggestion(null); setVerified(true); }}
                  className="mt-2 text-[11.5px] font-semibold text-[#B45309] hover:underline"
                >
                  Apply suggestion
                </button>
              </div>
            </motion.div>
          )}
          {!verifying && !suggestion && verified && (
            <motion.div key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#0F7A3E]">
              <CheckCircle2 className="w-4 h-4" /> Address verified
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        <div>
          <SectionLabel>Pickup instructions</SectionLabel>
          <p className="text-[11.5px] text-[#8893A8] mt-1">Gate codes, parking notes, call-on-arrival, side driveway, etc.</p>
          <textarea
            value={loc.instructions ?? ""}
            onChange={(e) => setLoc({ ...loc, instructions: e.target.value })}
            disabled={isLocked}
            rows={4}
            placeholder="Optional — share anything that helps the driver find and access your vehicle."
            className={`${FIELD} resize-none`}
          />
        </div>

        {/* Default + delete */}
        <div className="flex items-center justify-between pt-2">
          <label className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[#06194A] cursor-pointer">
            <input
              type="checkbox"
              checked={!!loc.isDefault}
              onChange={(e) => setLoc({ ...loc, isDefault: e.target.checked })}
              className="w-4 h-4 rounded border-[#C7D2FE] text-[#4F46E5] focus:ring-[#4F46E5]"
            />
            Make this my default pickup location
          </label>
          {location && onDelete && (
            <button
              onClick={() => { onDelete(location.id); toast.success("Location removed"); onClose(); }}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#B91C1C] hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>
    </SlideOver>
  );
};

/* ═══════════════════════ SAVED LOCATIONS DRAWER ═══════════════════════ */

export const SavedLocationsDrawer = ({
  open, onClose, locations, stage, onChange, pickupEnabled,
}: {
  open: boolean;
  onClose: () => void;
  locations: PickupLocation[];
  stage: TransactionStage;
  onChange: (locs: PickupLocation[]) => void;
  pickupEnabled: boolean;
}) => {
  const [editing, setEditing] = useState<PickupLocation | null>(null);
  const [creating, setCreating] = useState(false);

  const saveLoc = (loc: PickupLocation) => {
    const others = locations.filter((l) => l.id !== loc.id);
    const next = loc.isDefault ? [loc, ...others.map((l) => ({ ...l, isDefault: false }))] : [...others, loc];
    onChange(next);
  };
  const deleteLoc = (id: string) => onChange(locations.filter((l) => l.id !== id));
  const setDefault = (id: string) => {
    onChange(locations.map((l) => ({ ...l, isDefault: l.id === id })));
    toast.success("✅ Default location saved");
  };

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title="Saved Locations"
        subtitle={pickupEnabled ? "Manage every pickup address on your account" : "Pickup not available with this dealership"}
        width="lg"
        footer={
          pickupEnabled ? (
            <PrimaryButton onClick={() => setCreating(true)} className="w-full">
              <Plus className="w-4 h-4" /> Add Location
            </PrimaryButton>
          ) : (
            <SecondaryButton onClick={onClose} className="w-full">Close</SecondaryButton>
          )
        }
      >
        {!pickupEnabled ? (
          <div className="rounded-2xl border border-[#E6EAF0] bg-[#F7F8FB] p-5 text-center">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-white border border-[#E6EAF0] text-[#4F46E5] grid place-items-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-[#06194A]">Dealership drop-off only</div>
            <p className="text-[12.5px] text-[#53627A] mt-1 leading-relaxed">
              This dealership currently supports dealership drop-off only. Pickup logistics aren't enabled on your transaction.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <StageBanner stage={stage} />
            <AnimatePresence initial={false}>
              {locations.map((loc) => {
                const Icon = ADDRESS_ICONS[loc.type];
                return (
                  <motion.div
                    key={loc.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    whileHover={{ y: -2 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="group rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_-16px_rgba(79,70,229,0.35)] hover:border-[#4F46E5]/40 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#06194A] truncate">{loc.nickname || ADDRESS_LABELS[loc.type]}</span>
                          {loc.isDefault && <StatusPill tone="indigo"><Star className="w-3 h-3" /> Default</StatusPill>}
                          {loc.verified && <StatusPill tone="green"><Check className="w-3 h-3" /> Verified</StatusPill>}
                        </div>
                        <div className="text-[12px] text-[#53627A] mt-1 leading-relaxed">
                          {loc.street}{loc.unit ? `, ${loc.unit}` : ""}<br />
                          {loc.city}, {loc.state} {loc.zip}
                        </div>
                        {loc.instructions && (
                          <div className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-[#F7F8FB] px-2.5 py-1.5 text-[11.5px] text-[#53627A]">
                            <Shield className="w-3 h-3 text-[#4F46E5] mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{loc.instructions}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      {!loc.isDefault && (
                        <button
                          onClick={() => setDefault(loc.id)}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#4F46E5] hover:underline px-2 py-1"
                        >
                          <Star className="w-3 h-3" /> Set default
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(loc)}
                        className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#53627A] hover:text-[#4F46E5] px-2 py-1"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {locations.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#C7D2FE] bg-[#F7F8FB]/60 p-6 text-center">
                <div className="mx-auto w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center mb-2">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="text-sm font-semibold text-[#06194A]">No saved locations yet</div>
                <p className="text-[12px] text-[#53627A] mt-1">Add a pickup location to speed up scheduling.</p>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      <PickupAddressDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        location={editing}
        stage={stage}
        onSave={saveLoc}
        onDelete={deleteLoc}
      />
      <PickupAddressDrawer
        open={creating}
        onClose={() => setCreating(false)}
        location={null}
        stage={stage}
        onSave={saveLoc}
      />
    </>
  );
};

/* ═══════════════════════ PICKUP PREFERENCES DRAWER ═══════════════════════ */

export const PickupPreferencesDrawer = ({
  open, onClose, pickupEnabled, defaultLocation,
}: {
  open: boolean;
  onClose: () => void;
  pickupEnabled: boolean;
  defaultLocation?: PickupLocation;
}) => {
  const [contactless, setContactless] = useState(true);
  const [windowPref, setWindowPref] = useState<"morning" | "afternoon" | "evening">("morning");
  const [notes, setNotes] = useState("");

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Pickup Preferences"
      subtitle={pickupEnabled ? "Default behavior for vehicle handoff" : "Pickup currently disabled"}
      width="lg"
      footer={
        <div className="flex gap-2">
          <SecondaryButton onClick={onClose} className="flex-1">Cancel</SecondaryButton>
          <PrimaryButton onClick={() => { toast.success("Pickup preferences saved"); onClose(); }} className="flex-1">
            Save Preferences
          </PrimaryButton>
        </div>
      }
    >
      {!pickupEnabled ? (
        <div className="rounded-2xl border border-[#E6EAF0] bg-[#F7F8FB] p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#E6EAF0] text-[#4F46E5] grid place-items-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#06194A]">Dealership drop-off only</div>
              <p className="text-[12.5px] text-[#53627A] mt-1 leading-relaxed">
                This dealership doesn't offer vehicle pickup. You'll coordinate drop-off at their location during scheduling.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {defaultLocation && (
            <div className="rounded-2xl border border-[#C7D2FE]/60 bg-[#EEF0FF]/50 p-4">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span className="text-[11px] uppercase tracking-wide font-semibold text-[#4338CA]">Default pickup location</span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-[#06194A]">{defaultLocation.nickname}</div>
              <div className="text-[12px] text-[#53627A]">{defaultLocation.street}, {defaultLocation.city}, {defaultLocation.state} {defaultLocation.zip}</div>
            </div>
          )}

          <div>
            <SectionLabel>Preferred window</SectionLabel>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["morning", "afternoon", "evening"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowPref(w)}
                  className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold capitalize transition ${
                    windowPref === w
                      ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4338CA]"
                      : "border-[#E6EAF0] text-[#53627A] hover:border-[#4F46E5]/40"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-[#EEF0F4]">
            <div>
              <div className="text-sm font-semibold text-[#06194A]">Contactless handoff</div>
              <div className="text-[11.5px] text-[#53627A]">Leave keys in a pre-arranged location.</div>
            </div>
            <button
              role="switch"
              aria-checked={contactless}
              onClick={() => setContactless((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition ${contactless ? "bg-[#4F46E5]" : "bg-[#E6EAF0]"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${contactless ? "translate-x-4" : ""}`} />
            </button>
          </div>

          <div>
            <SectionLabel>Default driver notes</SectionLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Applied to every pickup unless overridden on a specific location."
              className={`${FIELD} resize-none`}
            />
          </div>
        </div>
      )}
    </SlideOver>
  );
};

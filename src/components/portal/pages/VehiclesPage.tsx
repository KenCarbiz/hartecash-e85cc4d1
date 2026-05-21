import { useState } from "react";
import { Plus, Car, Upload, Edit3, Trash2, ArrowRight, Camera } from "lucide-react";
import vehicleHero from "@/assets/portal-vehicle-rav4.png";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill, SectionLabel } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

type Props = { onNavigate: (k: "offers") => void };

const PHOTO_BUCKETS = [
  { label: "Exterior", count: 6, target: 8 },
  { label: "Interior", count: 4, target: 4 },
  { label: "Odometer", count: 1, target: 1 },
  { label: "Title",    count: 1, target: 1 },
  { label: "Damage",   count: 0, target: 0 },
];

export const VehiclesPage = ({ onNavigate }: Props) => {
  const [edit, setEdit] = useState(false);
  const [upload, setUpload] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const v = MOCK.vehicle;

  return (
    <PortalPageShell
      title="My Vehicles"
      subtitle="Manage vehicles connected to your acquisition offers."
      actions={<PrimaryButton><Plus className="w-4 h-4" /> Add Vehicle</PrimaryButton>}
    >
      {/* Active vehicle */}
      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5 items-center">
          <div className="relative h-[200px] rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#F2FBF6] grid place-items-center overflow-hidden">
            <img src={vehicleHero} alt="" className="w-auto h-full object-contain scale-[1.15] drop-shadow-[0_18px_14px_rgba(15,23,42,0.18)]" />
          </div>
          <div>
            <SectionLabel>Active Vehicle</SectionLabel>
            <h2 className="text-[22px] font-bold mt-1 leading-tight">
              {v.year} {v.make} {v.model} {v.trim}
            </h2>
            <p className="text-sm text-[#53627A]">{v.miles} mi • {v.engine} • {v.body}</p>
            <p className="text-xs font-mono text-[#53627A] mt-1">{v.vin}</p>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusPill tone="green">Firm Offer Ready</StatusPill>
              <StatusPill tone="orange">2 docs pending</StatusPill>
              <StatusPill tone="gray">Pickup not scheduled</StatusPill>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-4">
              <PrimaryButton onClick={() => onNavigate("offers")}>
                View Offer <ArrowRight className="w-4 h-4" />
              </PrimaryButton>
              <SecondaryButton onClick={() => setEdit(true)}><Edit3 className="w-4 h-4" /> Edit Vehicle</SecondaryButton>
              <SecondaryButton onClick={() => setUpload(true)}><Camera className="w-4 h-4" /> Upload Photos</SecondaryButton>
              <SecondaryButton onClick={() => setConfirmRemove(true)} className="text-[#B91C1C] hover:text-[#B91C1C] hover:border-[#FECACA]"><Trash2 className="w-4 h-4" /> Remove</SecondaryButton>
            </div>
          </div>
        </div>
      </Card>

      {/* Details + photos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <SectionLabel>Vehicle Details</SectionLabel>
          <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
            {[
              ["Trim", v.trim], ["Drivetrain", v.drivetrain], ["Engine", v.engine],
              ["Body", v.body], ["Exterior", v.exterior], ["Interior", v.interior],
              ["Ownership", v.ownership], ["Payoff", v.payoff ? fmt(v.payoff) : "None"],
            ].map(([k, val]) => (
              <div key={k as string}>
                <dt className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{k}</dt>
                <dd className="text-[#06194A] font-medium mt-0.5">{val}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Photo Upload</SectionLabel>
            <button onClick={() => setUpload(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">
              Manage
            </button>
          </div>
          <ul className="mt-3 space-y-2.5">
            {PHOTO_BUCKETS.map((b) => {
              const pct = b.target ? Math.min(100, (b.count / b.target) * 100) : 0;
              const complete = b.target > 0 && b.count >= b.target;
              return (
                <li key={b.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#06194A] font-medium">{b.label}</span>
                    <span className="text-[11px] text-[#53627A]">{b.count}{b.target ? ` / ${b.target}` : ""}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#F4F6FA] overflow-hidden">
                    <div className={`h-full ${complete ? "bg-[#16A34A]" : "bg-[#4F46E5]"}`} style={{ width: `${b.target ? pct : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Previous submissions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Previous Submissions</SectionLabel>
          <span className="text-[11px] text-[#8893A8]">2 vehicles</span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { y: 2018, mk: "Honda", mdl: "Accord Sport", mi: "62,180", status: "Sold • $14,800", tone: "green" as const },
            { y: 2016, mk: "Subaru", mdl: "Outback Limited", mi: "98,450", status: "Declined", tone: "gray" as const },
          ].map((p) => (
            <li key={`${p.y}${p.mdl}`} className="rounded-2xl border border-[#E6EAF0] p-4 flex items-center gap-3 hover:border-[#4F46E5]/30 transition">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center shrink-0">
                <Car className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#06194A] truncate">{p.y} {p.mk} {p.mdl}</div>
                <div className="text-[11px] text-[#53627A]">{p.mi} mi</div>
              </div>
              <StatusPill tone={p.tone}>{p.status}</StatusPill>
            </li>
          ))}
        </ul>
      </Card>

      {/* Slide-overs */}
      <SlideOver open={edit} onClose={() => setEdit(false)} title="Edit Vehicle"
        subtitle={`${v.year} ${v.make} ${v.model} ${v.trim}`}
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setEdit(false)} className="flex-1">Cancel</SecondaryButton><PrimaryButton onClick={() => setEdit(false)} className="flex-1">Save Changes</PrimaryButton></div>}>
        <div className="space-y-4">
          {[
            { label: "Mileage", value: v.miles },
            { label: "Exterior color", value: v.exterior },
            { label: "Interior color", value: v.interior },
            { label: "Ownership status", value: v.ownership },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{f.label}</span>
              <input defaultValue={f.value} className="mt-1 w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
            </label>
          ))}
        </div>
      </SlideOver>

      <SlideOver open={upload} onClose={() => setUpload(false)} title="Upload Vehicle Photos"
        subtitle="Add exterior, interior, odometer & damage shots" width="lg"
        footer={<PrimaryButton className="w-full">Continue</PrimaryButton>}>
        <button className="w-full border-2 border-dashed border-[#C7D2FE] bg-[#FAFBFE] rounded-2xl p-8 text-center hover:border-[#4F46E5] hover:bg-[#EEF0FF] transition">
          <Upload className="w-8 h-8 mx-auto text-[#4F46E5] mb-2" />
          <div className="text-sm font-semibold text-[#06194A]">Drop files or tap to upload</div>
          <div className="text-[11px] text-[#53627A] mt-1">JPG, PNG or HEIC up to 25MB</div>
        </button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PHOTO_BUCKETS.map((b) => (
            <button key={b.label} className="rounded-xl border border-[#E6EAF0] p-3 text-left hover:border-[#4F46E5]/40 transition">
              <div className="text-sm font-semibold text-[#06194A]">{b.label}</div>
              <div className="text-[11px] text-[#53627A]">{b.count}{b.target ? ` / ${b.target}` : ""} uploaded</div>
            </button>
          ))}
        </div>
      </SlideOver>

      <SlideOver open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove vehicle?" width="md"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setConfirmRemove(false)} className="flex-1">Cancel</SecondaryButton>
          <button onClick={() => setConfirmRemove(false)} className="flex-1 rounded-xl bg-[#DC2626] text-white text-sm font-semibold py-2.5 hover:bg-[#B91C1C] transition">Remove</button></div>}>
        <p className="text-sm text-[#53627A]">
          Removing this vehicle will cancel your active offer from {MOCK.customer.dealer} and delete uploaded photos and documents. This cannot be undone.
        </p>
      </SlideOver>
    </PortalPageShell>
  );
};

export default VehiclesPage;

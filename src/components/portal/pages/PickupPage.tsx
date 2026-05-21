import { useMemo, useState } from "react";
import { Truck, MapPin, Phone, Check, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { PORTAL_MOCK as MOCK } from "../portalMock";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

const TIME_WINDOWS = ["9-11 AM", "11 AM-1 PM", "1-3 PM", "3-5 PM"];

const buildDays = () => {
  const out: { date: Date; available: boolean }[] = [];
  const start = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    out.push({ date: d, available: dow !== 0 }); // Sundays unavailable
  }
  return out;
};

export const PickupPage = () => {
  const [schedule, setSchedule] = useState(false);
  const [editLoc, setEditLoc] = useState(false);
  const [contact, setContact] = useState(false);
  const days = useMemo(buildDays, []);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);

  return (
    <PortalPageShell title="Pickup Scheduling" subtitle="Pick a date and time — we'll handle the rest."
      actions={<PrimaryButton onClick={() => setSchedule(true)}><Calendar className="w-4 h-4" /> Schedule Pickup</PrimaryButton>}>

      {/* Status */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Pickup Status</SectionLabel>
            <div className="text-[20px] font-extrabold text-[#06194A] mt-1">Not Scheduled</div>
            <p className="text-sm text-[#53627A] mt-1">Accept your offer to unlock pickup scheduling.</p>
          </div>
          <StatusPill tone="orange">Awaiting Schedule</StatusPill>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1 sm:gap-2">
          {["Not Scheduled", "Scheduled", "Driver Assigned", "Completed"].map((s, i) => (
            <div key={s} className="flex flex-col items-center text-center">
              <div className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold ${i === 0 ? "bg-[#FEF3E2] text-[#F59E0B]" : "bg-[#F4F6FA] text-[#8893A8]"}`}>
                {i === 0 ? <Truck className="w-4 h-4" /> : i + 1}
              </div>
              <div className={`text-[11px] font-semibold mt-2 ${i === 0 ? "text-[#06194A]" : "text-[#8893A8]"}`}>{s}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
        {/* Calendar */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Choose a Pickup Date</SectionLabel>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-lg border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#F4F6FA]"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button className="w-7 h-7 rounded-lg border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#F4F6FA]"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const sel = selectedDay && d.date.toDateString() === selectedDay.toDateString();
              return (
                <button
                  key={d.date.toISOString()}
                  disabled={!d.available}
                  onClick={() => setSelectedDay(d.date)}
                  className={`aspect-square rounded-xl border text-sm font-semibold transition ${
                    !d.available ? "opacity-30 cursor-not-allowed border-[#E6EAF0] text-[#8893A8]"
                    : sel ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-[0_6px_16px_-6px_rgba(79,70,229,0.55)]"
                    : "border-[#E6EAF0] text-[#06194A] hover:border-[#4F46E5]/40 hover:bg-[#EEF0FF]/40"
                  }`}
                >
                  <div className="text-[10px] uppercase opacity-75 leading-none mt-1.5">{d.date.toLocaleDateString(undefined, { weekday: "short" })}</div>
                  <div className="text-base leading-tight">{d.date.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-[#8893A8] mb-2">Time Window</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_WINDOWS.map((w) => (
                <button key={w} onClick={() => setSelectedWindow(w)}
                  disabled={!selectedDay}
                  className={`rounded-xl py-2 text-sm font-semibold transition ${
                    selectedWindow === w ? "bg-[#4F46E5] text-white" : "bg-[#F7F8FB] text-[#06194A] hover:bg-[#EEF0FF] disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <PrimaryButton onClick={() => setSchedule(true)} className="mt-5 w-full py-3" >
            Confirm Pickup
          </PrimaryButton>
        </Card>

        {/* Location + driver */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Pickup Location</SectionLabel>
              <button onClick={() => setEditLoc(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">Edit</button>
            </div>
            <div className="mt-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <div className="font-semibold text-[#06194A]">Home address</div>
                <div className="text-[#53627A]">128 Oakridge Lane<br />Hartford, CT 06105</div>
              </div>
            </div>
            <SecondaryButton className="mt-3 w-full">Or drop off at dealership</SecondaryButton>
          </Card>

          <Card className="p-5">
            <SectionLabel>Driver / Transport</SectionLabel>
            <div className="mt-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#FEF3E2] text-[#F59E0B] grid place-items-center text-xs font-bold">MR</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#06194A]">Marcus R.</div>
                <div className="text-[11px] text-[#53627A]">ETA assigned after scheduling</div>
              </div>
              <button onClick={() => setContact(true)} aria-label="Contact driver"
                className="w-9 h-9 rounded-lg border border-[#E6EAF0] text-[#4F46E5] grid place-items-center hover:bg-[#EEF0FF] transition">
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Checklist */}
      <Card className="p-5">
        <SectionLabel>Pickup Checklist</SectionLabel>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "Remove all personal items",
            "Bring the title (signed)",
            "Bring both sets of keys",
            "Confirm odometer reading",
            "Have license / ID ready",
            "Cancel insurance after pickup",
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl border border-[#E6EAF0] px-3 py-2.5">
              <span className="w-5 h-5 rounded-md border-2 border-[#C7D2FE] grid place-items-center text-transparent hover:text-[#4F46E5] hover:border-[#4F46E5] transition cursor-pointer">
                <Check className="w-3 h-3" />
              </span>
              <span className="text-sm text-[#06194A]">{t}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Schedule drawer */}
      <SlideOver open={schedule} onClose={() => setSchedule(false)} title="Schedule Pickup"
        subtitle={selectedDay ? `${selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${selectedWindow ? ` • ${selectedWindow}` : ""}` : "Confirm pickup details"}
        footer={<PrimaryButton className="w-full">Confirm Pickup</PrimaryButton>}>
        <ol className="space-y-3 text-sm">
          {["Date & window", "Pickup address", "Vehicle ready & keys in hand", "Title signed and ready"].map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF0FF] text-[#4F46E5] font-bold text-xs grid place-items-center shrink-0">{i + 1}</span>
              <span className="text-[#06194A] pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </SlideOver>

      <SlideOver open={editLoc} onClose={() => setEditLoc(false)} title="Edit Pickup Location" width="md"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setEditLoc(false)} className="flex-1">Cancel</SecondaryButton><PrimaryButton onClick={() => setEditLoc(false)} className="flex-1">Save</PrimaryButton></div>}>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Address</span>
          <input defaultValue="128 Oakridge Lane" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">City</span>
            <input defaultValue="Hartford" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">ZIP</span>
            <input defaultValue="06105" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
          </label>
        </div>
      </SlideOver>

      <SlideOver open={contact} onClose={() => setContact(false)} title="Contact Driver" subtitle="Marcus R."
        footer={<PrimaryButton className="w-full">Send Message</PrimaryButton>}>
        <textarea rows={4} placeholder="e.g. Please call when you're 10 minutes out." className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SecondaryButton><Phone className="w-4 h-4" /> Call</SecondaryButton>
          <SecondaryButton>Text Driver</SecondaryButton>
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default PickupPage;

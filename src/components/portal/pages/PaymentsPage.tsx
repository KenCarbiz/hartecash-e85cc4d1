import { useState } from "react";
import { CreditCard, ShieldCheck, FileText, Plus, Check, Clock, Zap, Building2, Eye } from "lucide-react";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

const STEPS = ["Pending", "Processing", "Sent", "Completed"] as const;

export const PaymentsPage = () => {
  const [addMethod, setAddMethod] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const status = MOCK.payment.status;
  const currentIdx = STEPS.indexOf(status);

  return (
    <PortalPageShell title="Payment Center" subtitle="Track your payout and payment details — every step, fully secured.">
      {/* Status timeline */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Payment Status</SectionLabel>
          <StatusPill tone={status === "Pending" ? "orange" : "green"}>
            <Clock className="w-3 h-3" /> {status}
          </StatusPill>
        </div>
        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          {STEPS.map((s, i) => {
            const done = i <= currentIdx;
            return (
              <div key={s} className="flex flex-col items-center text-center">
                <div className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold ${
                  done ? "bg-[#4F46E5] text-white" : "bg-[#F4F6FA] text-[#8893A8]"
                }`}>
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <div className={`text-[11px] font-semibold mt-2 ${done ? "text-[#06194A]" : "text-[#8893A8]"}`}>{s}</div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-full mt-[-22px] -z-10 ${i < currentIdx ? "bg-[#4F46E5]" : "bg-[#E6EAF0]"}`} aria-hidden />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-[#53627A] mt-5 leading-snug">
          Funds are released after pickup is confirmed and the bill of sale is signed. ACH transfers settle in 1-2 business days.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mb-6">
        {/* Payout breakdown */}
        <Card className="p-5">
          <SectionLabel>Payout Amount</SectionLabel>
          <div className="text-[36px] font-extrabold text-[#06194A] mt-2 leading-none">{fmt(MOCK.payment.netPayout)}</div>
          <div className="text-sm text-[#53627A] mt-1">Estimated net to you after lien payoff and fees.</div>

          <dl className="mt-5 space-y-2.5 text-sm">
            {[
              ["Accepted offer",          MOCK.payment.offer, "indigo"],
              ["Lien payoff",             -MOCK.payment.payoff, "gray"],
              ["Pickup & processing fees", -MOCK.payment.fees, "gray"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between">
                <dt className="text-[#53627A]">{k}</dt>
                <dd className={`font-semibold tabular-nums ${(v as number) < 0 ? "text-[#DC2626]" : "text-[#06194A]"}`}>
                  {(v as number) < 0 ? "−" : ""}{fmt(Math.abs(v as number))}
                </dd>
              </div>
            ))}
            <div className="border-t border-[#EEF0F4] pt-3 flex items-center justify-between">
              <dt className="font-semibold text-[#06194A]">Net Payout</dt>
              <dd className="text-[20px] font-extrabold text-[#0F7A3E] tabular-nums">{fmt(MOCK.payment.netPayout)}</dd>
            </div>
          </dl>
        </Card>

        {/* Payment method */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Payment Method</SectionLabel>
            <button onClick={() => setAddMethod(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              { Icon: Building2, label: "ACH Direct Deposit", sub: "Chase •••• 4127",   tone: "green" as const, active: true },
              { Icon: FileText, label: "Paper Check",         sub: "Mailed in 3-5 days", tone: "gray"  as const, active: false },
              { Icon: Zap,      label: "Instant Payout",      sub: "1% fee · debit card", tone: "indigo" as const, active: false },
            ].map((m) => (
              <li key={m.label} className={`flex items-center gap-3 rounded-xl border p-3 ${m.active ? "border-[#C7D2FE] bg-[#EEF0FF]/40" : "border-[#E6EAF0]"}`}>
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E6EAF0] grid place-items-center text-[#4F46E5] shrink-0">
                  <m.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#06194A]">{m.label}</div>
                  <div className="text-[11px] text-[#53627A]">{m.sub}</div>
                </div>
                {m.active ? <StatusPill tone="green"><Check className="w-3 h-3" /> Active</StatusPill> : <button className="text-xs font-semibold text-[#4F46E5] hover:underline">Choose</button>}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-[#F7F8FB] p-3 text-[12px] text-[#53627A] inline-flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16A34A] mt-0.5" />
            Bank details are tokenized and never stored on our servers.
          </div>
        </Card>
      </div>

      {/* Receipts */}
      <Card className="p-5">
        <SectionLabel>Receipts &amp; Records</SectionLabel>
        <ul className="mt-3 divide-y divide-[#EEF0F4]">
          {[
            { name: "Bill of Sale",            status: "Pending signature", tone: "orange" as const },
            { name: "Payment Confirmation",    status: "Available after payout", tone: "gray" as const },
            { name: "Payoff Confirmation",     status: "Not applicable",    tone: "gray" as const },
          ].map((r) => (
            <li key={r.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#06194A]">{r.name}</div>
                  <StatusPill tone={r.tone}>{r.status}</StatusPill>
                </div>
              </div>
              <SecondaryButton onClick={() => setReceipt(r.name)} className="px-3 py-2 text-xs">
                <Eye className="w-3.5 h-3.5" /> View
              </SecondaryButton>
            </li>
          ))}
        </ul>
      </Card>

      {/* Add payment method drawer */}
      <SlideOver open={addMethod} onClose={() => setAddMethod(false)} title="Add Payment Method"
        subtitle="Securely linked via our banking partner" width="lg"
        footer={<PrimaryButton className="w-full">Verify & Save</PrimaryButton>}>
        <div className="space-y-3">
          {[
            { label: "Account holder name", placeholder: MOCK.customer.name },
            { label: "Routing number",      placeholder: "•••• ••• ••" },
            { label: "Account number",      placeholder: "•••• •••• 4127" },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{f.label}</span>
              <input placeholder={f.placeholder} className="mt-1 w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
            </label>
          ))}
        </div>
        <div className="mt-5 rounded-2xl bg-[#F7F8FB] p-4 text-[12px] text-[#53627A] inline-flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] mt-0.5" /> Bank-grade encryption. Verified through Plaid.
        </div>
      </SlideOver>

      {/* Receipt modal */}
      <SlideOver open={!!receipt} onClose={() => setReceipt(null)} title={receipt ?? ""} subtitle="Document preview" width="lg"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setReceipt(null)} className="flex-1">Close</SecondaryButton><PrimaryButton className="flex-1">Download PDF</PrimaryButton></div>}>
        <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-[#4F46E5]" />
          <div className="text-sm font-semibold text-[#06194A] mt-2">{receipt}</div>
          <div className="text-[12px] text-[#53627A] mt-1">Will be available once payment is released.</div>
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default PaymentsPage;

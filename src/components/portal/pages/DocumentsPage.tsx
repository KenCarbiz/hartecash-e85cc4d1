import { useState } from "react";
import {
  Upload,
  Eye,
  RefreshCw,
  ShieldCheck,
  Lock,
  FileText,
  AlertCircle,
  Smartphone,
  Clock,
  Car,
  CheckCircle2,
  QrCode,
  Info,
  MessageSquare,
  Link2,
} from "lucide-react";
import { usePortalData } from "../PortalDataContext";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill, SectionLabel } from "../PortalPageShell";
import { DocumentUploadHub, type HubDoc, type HubDocStatus } from "../DocumentUploadHub";

const STATUS_TONE: Record<HubDocStatus, "green" | "indigo" | "orange" | "gray" | "red"> = {
  Approved: "green",
  Uploaded: "indigo",
  "Under Review": "orange",
  Needed: "gray",
  Rejected: "red",
};

const HELPER_TEXT: Record<string, string> = {
  "Payoff Statement": "Needed if your vehicle has a loan or lien.",
  "Insurance Card": "Helps verify ownership and vehicle details.",
};

const REJECT_TIP: Record<string, string> = {
  "Driver's License": "Tip: Place your license on a flat surface and avoid glare.",
  "Drivers License": "Tip: Place your license on a flat surface and avoid glare.",
};

export const DocumentsPage = () => {
  const MOCK = usePortalData();
  const [hubOpen, setHubOpen] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Seed one rejected doc for realism
  const docs: HubDoc[] = MOCK.docs.map((d, i) =>
    i === 2
      ? { ...d, status: "Rejected" as const, reason: "Image blurry — please retake in better light." }
      : (d as HubDoc)
  );

  const completed = docs.filter((d) => d.status === "Approved" || d.status === "Uploaded").length;
  const total = docs.length;
  const pct = Math.round((completed / total) * 100);
  const remaining = docs.filter((d) => d.status === "Needed" || d.status === "Rejected").length;

  const vehicle = MOCK.vehicle;
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const firmOffer = MOCK.firmOffer;
  const dealer = MOCK.customer.dealer;

  const openHub = (name?: string) => {
    setFocus(name ?? null);
    setHubOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <PortalPageShell
      title="Documents"
      subtitle="Secure upload center for your vehicle sale."
      actions={
        <PrimaryButton onClick={() => openHub()}>
          <Upload className="w-4 h-4" /> Open Upload Hub
        </PrimaryButton>
      }
    >
      {/* Progress + offer context */}
      <Card className="p-5 mb-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
          {/* Left: progress */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SectionLabel>Progress</SectionLabel>
              <StatusPill tone="orange">Documents in progress</StatusPill>
            </div>
            <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
              <div className="text-[22px] font-extrabold text-[#06194A]">
                {completed} of {total} documents completed
              </div>
              <div className="text-[14px] font-bold text-[#4F46E5]">{pct}%</div>
            </div>

            <div className="mt-3 h-2.5 rounded-full bg-[#F4F6FA] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#7C3AED] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-3 flex items-center gap-3 text-[12px] text-[#53627A] flex-wrap">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> Secure upload</span>
              <span className="text-[#CBD2E0]">·</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#16A34A]" /> Encrypted</span>
              <span className="text-[#CBD2E0]">·</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#4F46E5]" /> Dealer reviewed</span>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <SecondaryButton onClick={() => openHub()}>
                <Smartphone className="w-4 h-4" /> Continue on Phone
              </SecondaryButton>
              <SecondaryButton onClick={() => openHub()}>
                <QrCode className="w-4 h-4" /> Show QR Code
              </SecondaryButton>
            </div>
          </div>

          {/* Right: offer context */}
          <div className="lg:w-[260px] rounded-2xl border border-[#E5E9F2] bg-gradient-to-br from-[#F8FAFF] to-[#F5F3FF] p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#53627A]">
              <Car className="w-3.5 h-3.5" /> Transaction
            </div>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-[11px] text-[#53627A]">Vehicle</div>
                <div className="text-[13px] font-extrabold text-[#06194A] truncate">{vehicleLabel}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#53627A]">Accepted Offer</div>
                <div className="text-[18px] font-extrabold text-[#16A34A] leading-tight">
                  ${firmOffer.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#53627A]">Dealer</div>
                <div className="text-[12px] font-semibold text-[#06194A] truncate">{dealer}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Continue on phone — premium banner */}
      <Card className="p-4 mb-4 border-[#C7D2FE] bg-gradient-to-r from-[#EEF0FF] via-white to-[#F5F3FF]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-[#06194A] text-white grid place-items-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="text-[14px] font-extrabold text-[#06194A]">Continue on your phone</div>
            <div className="text-[12.5px] text-[#53627A] mt-0.5">
              Scan once and complete your uploads from your phone camera.
            </div>
            <div className="text-[11px] text-[#53627A] mt-1 inline-flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> ~{Math.max(1, remaining * 2)} min</span>
              <span>·</span>
              <span>{remaining} document{remaining === 1 ? "" : "s"} remaining</span>
              <span>·</span>
              <span className="text-[#4F46E5] font-semibold">Session stays in sync</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => openHub()} className="px-3 py-2">
              <QrCode className="w-3.5 h-3.5" /> Show QR Code
            </SecondaryButton>
            <PrimaryButton onClick={() => openHub()} className="px-3 py-2">
              Open Hub →
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* Document cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((d) => {
          const needed = d.status === "Needed";
          const rejected = d.status === "Rejected";
          const approved = d.status === "Approved";
          const helper = needed ? HELPER_TEXT[d.name] : null;
          const tip = rejected ? REJECT_TIP[d.name] : null;
          return (
            <Card key={d.name} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 ${
                    needed
                      ? "bg-[#F4F6FA] text-[#53627A]"
                      : rejected
                      ? "bg-[#FEE2E2] text-[#DC2626]"
                      : approved
                      ? "bg-[#DCFCE7] text-[#16A34A]"
                      : "bg-[#EEF0FF] text-[#4F46E5]"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#06194A] truncate">{d.name}</span>
                    <StatusPill tone={STATUS_TONE[d.status]}>{d.status}</StatusPill>
                  </div>
                  <div className="text-[11px] text-[#53627A] mt-0.5">
                    {d.date
                      ? `Uploaded ${d.date}${approved ? " · Dealer reviewed" : ""}`
                      : needed
                      ? "Needed"
                      : "Not yet uploaded"}
                  </div>

                  {helper && (
                    <div className="mt-2 text-[12px] text-[#53627A] inline-flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#4F46E5]" />
                      {helper}
                    </div>
                  )}

                  {rejected && d.reason && (
                    <div className="mt-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C] flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div>{d.reason}</div>
                        {tip && <div className="mt-1 text-[#7F1D1D]/80">{tip}</div>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {needed ? (
                      <PrimaryButton onClick={() => openHub(d.name)} className="px-3 py-2">
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </PrimaryButton>
                    ) : rejected ? (
                      <PrimaryButton onClick={() => openHub(d.name)} className="px-3 py-2">
                        <RefreshCw className="w-3.5 h-3.5" /> Retake / Resubmit
                      </PrimaryButton>
                    ) : (
                      <>
                        <SecondaryButton onClick={() => openHub(d.name)} className="px-3 py-2">
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </SecondaryButton>
                        <SecondaryButton onClick={() => openHub(d.name)} className="px-3 py-2">
                          <RefreshCw className="w-3.5 h-3.5" /> Replace
                        </SecondaryButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* What happens next */}
      <Card className="p-4 mt-4 border-[#E5E9F2] bg-[#F8FAFF]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E9F2] grid place-items-center shrink-0 text-[#4F46E5]">
            <Info className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-[#06194A]">What happens after upload?</div>
            <p className="text-[12.5px] text-[#53627A] mt-1 leading-relaxed">
              We'll review your documents and let you know if anything needs attention. Once
              everything is approved, your visit or pickup can move forward.
            </p>
          </div>
        </div>
      </Card>

      {/* Centralized Upload Hub — single persistent cross-device experience */}
      <DocumentUploadHub
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        docs={docs}
        focusDoc={focus}
      />
    </PortalPageShell>
  );
};

export default DocumentsPage;

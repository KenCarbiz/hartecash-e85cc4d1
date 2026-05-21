import { useState } from "react";
import { Upload, Eye, RefreshCw, ShieldCheck, Lock, FileText, AlertCircle, Smartphone, Sparkles, Clock } from "lucide-react";
import { PORTAL_MOCK as MOCK } from "../portalMock";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill, SectionLabel } from "../PortalPageShell";
import { DocumentUploadHub, type HubDoc, type HubDocStatus } from "../DocumentUploadHub";

const STATUS_TONE: Record<HubDocStatus, "green" | "indigo" | "orange" | "gray" | "red"> = {
  Approved: "green",
  Uploaded: "indigo",
  "Under Review": "orange",
  Needed: "gray",
  Rejected: "red",
};

export const DocumentsPage = () => {
  const [hubOpen, setHubOpen] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  // Seed one rejected doc for realism
  const docs: HubDoc[] = MOCK.docs.map((d, i) =>
    i === 2
      ? { ...d, status: "Rejected" as const, reason: "Image blurry — please retake in better light." }
      : (d as HubDoc)
  );

  const completed = docs.filter((d) => d.status === "Approved" || d.status === "Uploaded").length;
  const total = docs.length;
  const pct = (completed / total) * 100;
  const remaining = docs.filter((d) => d.status === "Needed" || d.status === "Rejected").length;

  const openHub = (name?: string) => {
    setFocus(name ?? null);
    setHubOpen(true);
  };

  return (
    <PortalPageShell
      title="Documents"
      subtitle="One synced upload session — desktop or mobile."
      actions={
        <PrimaryButton onClick={() => openHub()}>
          <Upload className="w-4 h-4" /> Open Upload Hub
        </PrimaryButton>
      }
    >
      {/* Progress + cross-device CTA */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <SectionLabel>Progress</SectionLabel>
            <div className="text-[22px] font-extrabold text-[#06194A] mt-1">
              {completed} of {total} documents completed
            </div>
            <p className="text-sm text-[#53627A] mt-1">
              Switch between devices anytime — your session stays in sync.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-[#53627A]">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> SOC 2</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#16A34A]" /> Encrypted</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" /> AI verified</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#F4F6FA] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Cross-device launcher */}
        <button
          onClick={() => openHub()}
          className="mt-4 w-full text-left rounded-2xl border border-[#C7D2FE] bg-gradient-to-r from-[#EEF0FF] via-white to-[#F5F3FF] p-4 hover:shadow-md transition group"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#06194A] text-white grid place-items-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-extrabold text-[#06194A]">
                Continue on your phone
              </div>
              <div className="text-[12px] text-[#53627A] mt-0.5 inline-flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> ~{Math.max(1, remaining * 2)} min</span>
                <span>·</span>
                <span>{remaining} document{remaining === 1 ? "" : "s"} remaining</span>
                <span>·</span>
                <span className="text-[#4F46E5] font-semibold">Scan once — full session transfers</span>
              </div>
            </div>
            <div className="text-[11px] font-bold text-[#4F46E5] uppercase tracking-wider group-hover:translate-x-0.5 transition">
              Open Hub →
            </div>
          </div>
        </button>
      </Card>

      {/* Checklist preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((d) => {
          const needed = d.status === "Needed";
          const rejected = d.status === "Rejected";
          return (
            <Card key={d.name} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 ${
                    needed
                      ? "bg-[#F4F6FA] text-[#53627A]"
                      : rejected
                      ? "bg-[#FEE2E2] text-[#DC2626]"
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
                    {d.date ? `Uploaded ${d.date}` : "Not yet uploaded"}
                  </div>
                  {rejected && d.reason && (
                    <div className="mt-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C] inline-flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {d.reason}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {needed || rejected ? (
                      <PrimaryButton onClick={() => openHub(d.name)} className="px-3 py-2">
                        <Upload className="w-3.5 h-3.5" /> {rejected ? "Resubmit" : "Upload"}
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

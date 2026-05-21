import { useState } from "react";
import { Upload, Eye, RefreshCw, ShieldCheck, Lock, FileText, AlertCircle, Check } from "lucide-react";
import { PORTAL_MOCK as MOCK } from "../portalMock";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill, SectionLabel } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";
import { DocumentUploadDrawer } from "../DocumentUploadDrawer";


const STATUS_TONE = {
  "Approved":     "green",
  "Uploaded":     "indigo",
  "Under Review": "orange",
  "Needed":       "gray",
  "Rejected":     "red",
} as const;

type DocStatus = keyof typeof STATUS_TONE;

export const DocumentsPage = () => {
  const [upload, setUpload] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Inject one rejected example for realism
  const docs = MOCK.docs.map((d, i) =>
    i === 2 ? { ...d, status: "Rejected" as DocStatus, reason: "Image blurry — please retake in better light." } : d as typeof d & { reason?: string }
  );

  const completed = docs.filter((d) => d.status === "Approved" || d.status === "Uploaded").length;
  const total = docs.length;
  const pct = (completed / total) * 100;

  return (
    <PortalPageShell
      title="Documents"
      subtitle="Upload and verify required paperwork."
      actions={<PrimaryButton onClick={() => setUpload("New document")}><Upload className="w-4 h-4" /> Upload</PrimaryButton>}
    >
      {/* Progress card */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Progress</SectionLabel>
            <div className="text-[22px] font-extrabold text-[#06194A] mt-1">{completed} of {total} documents completed</div>
            <p className="text-sm text-[#53627A] mt-1">All documents are encrypted and only shared with your dealer team.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[12px] text-[#53627A]">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> SOC 2</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#16A34A]" /> Encrypted</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#F4F6FA] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Drag-and-drop area */}
      <button
        onClick={() => setUpload("New document")}
        className="w-full mb-6 border-2 border-dashed border-[#C7D2FE] bg-white hover:bg-[#EEF0FF]/40 rounded-2xl p-8 text-center transition group"
      >
        <Upload className="w-8 h-8 mx-auto text-[#4F46E5] mb-2 group-hover:scale-110 transition-transform" />
        <div className="text-sm font-semibold text-[#06194A]">Drop a file or tap to upload</div>
        <div className="text-[12px] text-[#53627A] mt-1">PDF, JPG, PNG, or HEIC up to 25MB · use your camera on mobile</div>
      </button>

      {/* Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((d) => {
          const status = d.status as DocStatus;
          const tone = STATUS_TONE[status];
          const needed = status === "Needed";
          const rejected = status === "Rejected";
          return (
            <Card key={d.name} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 ${needed ? "bg-[#F4F6FA] text-[#53627A]" : rejected ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#EEF0FF] text-[#4F46E5]"}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#06194A] truncate">{d.name}</span>
                    <StatusPill tone={tone}>{status}</StatusPill>
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
                      <PrimaryButton onClick={() => setUpload(d.name)} className="px-3 py-2">
                        <Upload className="w-3.5 h-3.5" /> {rejected ? "Resubmit" : "Upload"}
                      </PrimaryButton>
                    ) : (
                      <>
                        <SecondaryButton onClick={() => setPreview(d.name)} className="px-3 py-2"><Eye className="w-3.5 h-3.5" /> Preview</SecondaryButton>
                        <SecondaryButton onClick={() => setUpload(d.name)} className="px-3 py-2"><RefreshCw className="w-3.5 h-3.5" /> Replace</SecondaryButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Premium upload drawer with mobile handoff */}
      <DocumentUploadDrawer
        open={!!upload}
        onClose={() => setUpload(null)}
        docName={upload ?? "Document"}
      />


      {/* Preview modal (also slide-over for consistency) */}
      <SlideOver open={!!preview} onClose={() => setPreview(null)} title={`${preview ?? ""} Preview`} width="lg"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setPreview(null)} className="flex-1">Close</SecondaryButton><PrimaryButton className="flex-1">Replace File</PrimaryButton></div>}>
        <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-10 text-center">
          <FileText className="w-12 h-12 mx-auto text-[#4F46E5] mb-2" />
          <div className="text-sm font-semibold text-[#06194A]">{preview}</div>
          <div className="text-[11px] text-[#53627A] mt-1">Preview rendering…</div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 text-[12px] text-[#0F7A3E] font-semibold">
          <Check className="w-3.5 h-3.5" /> Verified by Liberty Automotive
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default DocumentsPage;

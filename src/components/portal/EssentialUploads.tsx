import { useRef, useState } from "react";
import { Camera, ScrollText, CreditCard, Check, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { toast } from "sonner";

interface EssentialUploadsProps {
  token: string;
  submissionId: string;
}

type SlotKey = "odometer" | "title_front" | "drivers_license_front";
type SlotState = "idle" | "uploading" | "done";

const SLOTS: Array<{
  key: SlotKey;
  label: string;
  helper: string;
  icon: typeof Camera;
  bucket: "submission-photos" | "customer-documents";
}> = [
  {
    key: "odometer",
    label: "Odometer photo",
    helper: "Show the dashboard mileage clearly",
    icon: Camera,
    bucket: "submission-photos",
  },
  {
    key: "title_front",
    label: "Title photo",
    helper: "Front of the title",
    icon: ScrollText,
    bucket: "customer-documents",
  },
  {
    key: "drivers_license_front",
    label: "Driver's license",
    helper: "Front side, all four corners visible",
    icon: CreditCard,
    bucket: "customer-documents",
  },
];

/**
 * Carvana-style "lock it in with three uploads" panel rendered
 * directly on DealAccepted. The customer accepts → sees three tiles
 * → taps each → camera opens → uploaded. Removes the page hop to
 * /upload and /docs that historically split essential from optional.
 *
 * The full UploadPhotos / UploadDocs pages still exist for the
 * exhaustive flow (interior, all corners, registration, license back,
 * title back). This is the bare minimum to confirm the deal —
 * matches Carvana's odometer + title + ID requirement at acceptance.
 */
const EssentialUploads = ({ token, submissionId }: EssentialUploadsProps) => {
  const [slotStates, setSlotStates] = useState<Record<SlotKey, SlotState>>({
    odometer: "idle",
    title_front: "idle",
    drivers_license_front: "idle",
  });
  const inputRefs = useRef<Record<SlotKey, HTMLInputElement | null>>({
    odometer: null,
    title_front: null,
    drivers_license_front: null,
  });
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);

  const triggerForSlot = (key: SlotKey) => {
    setActiveSlot(key);
    setTimeout(() => inputRefs.current[key]?.click(), 50);
  };

  const handleFile = async (key: SlotKey, file: File | null) => {
    if (!file) return;
    setSlotStates((prev) => ({ ...prev, [key]: "uploading" }));

    try {
      const slot = SLOTS.find((s) => s.key === key)!;
      const ext = file.name.split(".").pop() || "jpg";
      const stamp = Date.now();
      const path =
        slot.bucket === "submission-photos"
          ? `${token}/${key}-${stamp}.${ext}`
          : `${token}/${key}/${stamp}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(slot.bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      // Trigger the corresponding "X uploaded" notification + flip the
      // submission-level boolean so the dealer sees progress.
      if (slot.bucket === "submission-photos") {
        await supabase.rpc("mark_photos_uploaded", { _token: token } as any);
        safeInvoke("send-notification", {
          body: { trigger_key: "photos_uploaded", submission_id: submissionId },
          context: { from: "EssentialUploads.odometer" },
        });
      } else {
        await supabase.rpc("mark_docs_uploaded", { _token: token } as any);
        safeInvoke("send-notification", {
          body: { trigger_key: "docs_uploaded", submission_id: submissionId },
          context: { from: `EssentialUploads.${key}` },
        });
      }

      setSlotStates((prev) => ({ ...prev, [key]: "done" }));
    } catch (e: any) {
      setSlotStates((prev) => ({ ...prev, [key]: "idle" }));
      toast.error("Upload failed", {
        description: e?.message || "Try again or use the full upload page.",
      });
    } finally {
      setActiveSlot(null);
    }
  };

  const allDone =
    slotStates.odometer === "done" &&
    slotStates.title_front === "done" &&
    slotStates.drivers_license_front === "done";

  return (
    <div className="rounded-2xl border-2 border-success/30 bg-gradient-to-br from-success/5 via-card to-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-success">
            Lock it in
          </p>
          <h3 className="font-bold text-card-foreground text-base mt-0.5">
            Three quick uploads to confirm
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Snap each from your phone — takes under a minute.
          </p>
        </div>
        {allDone && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full shrink-0">
            <Check className="w-3.5 h-3.5" />
            All set
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {SLOTS.map((slot) => {
          const state = slotStates[slot.key];
          const Icon = slot.icon;
          const isActive = activeSlot === slot.key;
          return (
            <button
              key={slot.key}
              onClick={() => triggerForSlot(slot.key)}
              disabled={state === "uploading" || state === "done"}
              className={`relative flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 text-center transition-all ${
                state === "done"
                  ? "border-success/40 bg-success/10 cursor-default"
                  : state === "uploading"
                  ? "border-primary/30 bg-primary/5"
                  : "border-dashed border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <input
                ref={(el) => (inputRefs.current[slot.key] = el)}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(slot.key, e.target.files?.[0] || null)}
              />
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  state === "done"
                    ? "bg-success text-white"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {state === "uploading" && isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : state === "done" ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-card-foreground">{slot.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {state === "done" ? "Uploaded" : slot.helper}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Link
        to={`/upload/${token}`}
        className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        Want to add more? Upload the full photo set
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

export default EssentialUploads;

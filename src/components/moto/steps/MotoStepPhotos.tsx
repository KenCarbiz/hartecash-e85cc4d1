import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState } from "../types";

const REQUIRED = [
  { id: "front", label: "Front" },
  { id: "rear", label: "Rear" },
  { id: "driver-side", label: "Driver Side" },
  { id: "passenger-side", label: "Passenger Side" },
  { id: "dashboard", label: "Dashboard / Odometer" },
  { id: "interior", label: "Interior" },
];

type Slot = { file?: File; preview?: string; uploaded?: boolean };

const MotoStepPhotos = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const { toast } = useToast();
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reappraising, setReappraising] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = state.submissionToken;

  const onPick = (id: string) => {
    setActiveId(id);
    fileRef.current?.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please pick an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSlots((p) => ({ ...p, [activeId]: { file, preview: ev.target?.result as string } }));
    };
    reader.readAsDataURL(file);
    setActiveId(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const allFilled = REQUIRED.every((r) => slots[r.id]?.file || slots[r.id]?.uploaded);

  const submitAll = async () => {
    if (!token) {
      toast({ title: "Missing submission token", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      for (const r of REQUIRED) {
        const s = slots[r.id];
        if (!s?.file) continue;
        const ext = s.file.name.split(".").pop() || "jpg";
        const path = `${token}/${r.id}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("submission-photos")
          .upload(path, s.file, { contentType: s.file.type, upsert: false });
        if (error) throw error;
      }
      // Mark uploaded and trigger AI analysis.
      try {
        await supabase.rpc("mark_photos_uploaded", { _token: token });
      } catch (rpcErr) {
        console.warn("mark_photos_uploaded RPC failed (non-fatal):", rpcErr);
      }
      setUploading(false);
      setReappraising(true);

      const { data, error } = await supabase.functions.invoke("boost-evaluate", {
        body: { submission_id: state.submissionId },
      });
      if (error) throw error;

      const newOffer: number | undefined =
        (data as { new_offer?: number; suggested_offer?: number } | null)?.new_offer ??
        (data as { suggested_offer?: number } | null)?.suggested_offer;

      if (newOffer && newOffer > 0) {
        onNext({
          offer: {
            low: state.offer.low,
            high: state.offer.high,
            firm: newOffer,
            aiBumped: true,
          },
          step: "offer",
          declined: false,
        });
      } else {
        // No improvement — route to queue so an appraiser can review.
        onNext({ step: "queued" });
      }
    } catch (e) {
      console.error("[MotoStepPhotos] failed:", e);
      toast({
        title: "Couldn't process photos",
        description: (e as Error)?.message || "Try again or call the dealership.",
        variant: "destructive",
      });
      setUploading(false);
      setReappraising(false);
    }
  };

  if (reappraising) {
    return (
      <>
        <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
        <MotoCard>
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--cta-offer))]" />
            <p className="mt-3 text-sm font-medium text-zinc-900">
              Running AI photo appraisal…
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Analyzing condition, mileage, and damage. This usually takes under 30 seconds.
            </p>
          </div>
        </MotoCard>
      </>
    );
  }

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard title="Upload 6 Quick Photos">
        <p className="mb-3 text-sm text-zinc-600">
          We'll review your photos and come back with a new firm offer in seconds.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {REQUIRED.map((r) => {
            const slot = slots[r.id];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r.id)}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-left hover:border-zinc-300"
              >
                {slot?.preview ? (
                  <>
                    <img src={slot.preview} alt={r.label} className="h-full w-full object-cover" />
                    <span
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-zinc-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlots((p) => { const n = { ...p }; delete n[r.id]; return n; });
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-500">
                    <Camera className="h-6 w-6" />
                    <span className="text-xs font-medium">{r.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </MotoCard>
      <div className="mt-5">
        <MotoPrimaryButton
          disabled={!allFilled || uploading}
          loading={uploading}
          onClick={submitAll}
        >
          Get My New Offer
        </MotoPrimaryButton>
      </div>
    </>
  );
};

export default MotoStepPhotos;

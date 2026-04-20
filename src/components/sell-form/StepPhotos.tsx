import { useState, useRef, useCallback } from "react";
import { Camera, CheckCircle2, Loader2, Sparkles, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * StepPhotos — optional in-form AI condition scoring.
 *
 * Asks the customer for the four mandatory exterior angles (industry
 * guidance for AI damage detection) plus four nice-to-have shots. Each
 * upload streams to Supabase storage and triggers analyze-vehicle-damage,
 * which writes a damage_report row and updates ai_condition_score on the
 * submission. The offer engine reads ai_condition_score in calcAIConditionAdjustment.
 *
 * The customer can skip — pricing then falls back to their self-reported
 * condition. The dealer toggles the whole step on/off via
 * site_config.ai_condition_scoring_enabled.
 */

export interface PhotoSlot {
  id: string;          // shot_id (front, rear, driver_side, passenger_side, interior, ...)
  label: string;       // "Front 3/4"
  hint: string;        // "Stand at the corner — capture the full front and one side"
  required: boolean;   // counts toward the "you need 4 to continue" gate
}

const DEFAULT_SLOTS: PhotoSlot[] = [
  { id: "front",          label: "Front 3/4",          hint: "Stand at the front corner — capture the full bumper and one side.",            required: true  },
  { id: "rear",           label: "Rear 3/4",           hint: "Stand at the rear corner — capture the full bumper and one side.",              required: true  },
  { id: "driver_side",    label: "Driver Side",        hint: "Step back so the whole car is in frame, wheels visible.",                       required: true  },
  { id: "passenger_side", label: "Passenger Side",     hint: "Step back so the whole car is in frame, wheels visible.",                       required: true  },
  { id: "dashboard",      label: "Dashboard & Odometer", hint: "Capture the full dash — odometer reading must be readable.",                    required: false },
  { id: "interior",       label: "Front Interior",     hint: "Front seats, console, and steering wheel.",                                      required: false },
  { id: "wheel",          label: "Wheel / Tire",       hint: "Fill the frame with one wheel — tread depth visible.",                            required: false },
  { id: "windshield",     label: "Windshield",         hint: "Look for chips and cracks. Stand at the front corner.",                          required: false },
];

interface UploadState {
  status: "idle" | "uploading" | "analyzing" | "done" | "error";
  url?: string;
  storagePath?: string;
  error?: string;
}

interface Props {
  submissionToken: string;        // pre-issued token used to namespace storage
  dealershipId: string;
  slots?: PhotoSlot[];
  minRequired?: number;           // gate before "Continue" enables; defaults to count of required slots
  onComplete: (result: { uploadedSlots: string[]; aiAvailable: boolean }) => void;
  onSkip: () => void;
}

const StepPhotos = ({
  submissionToken,
  dealershipId,
  slots = DEFAULT_SLOTS,
  minRequired,
  onComplete,
  onSkip,
}: Props) => {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const requiredSlots = slots.filter((s) => s.required);
  const requiredCount = minRequired ?? requiredSlots.length;
  const requiredDone = requiredSlots.filter((s) => uploads[s.id]?.status === "done").length;
  const totalDone = Object.values(uploads).filter((u) => u.status === "done").length;
  const canContinue = requiredDone >= requiredCount;

  const handleFile = useCallback(
    async (slot: PhotoSlot, file: File) => {
      if (file.size > 12 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Please pick a photo under 12 MB.", variant: "destructive" });
        return;
      }

      setUploads((prev) => ({ ...prev, [slot.id]: { status: "uploading" } }));

      // Storage path scoped by token so each customer's photos are isolated
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${submissionToken}/${slot.id}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("submission-photos")
        .upload(storagePath, file, { upsert: true, contentType: file.type });

      if (uploadErr) {
        setUploads((prev) => ({ ...prev, [slot.id]: { status: "error", error: uploadErr.message } }));
        toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
        return;
      }

      const { data: urlData } = supabase.storage.from("submission-photos").getPublicUrl(storagePath);
      setUploads((prev) => ({
        ...prev,
        [slot.id]: { status: "analyzing", url: urlData.publicUrl, storagePath },
      }));

      // Fire-and-forget AI analysis; we don't block the user on the result.
      // The damage report row is created server-side; the offer engine
      // picks up the aggregated ai_condition_score later.
      supabase.functions
        .invoke("analyze-vehicle-damage", {
          body: {
            submission_token: submissionToken,
            dealership_id: dealershipId,
            photo_category: slot.id,
            photo_path: storagePath,
          },
        })
        .then(() => {
          setUploads((prev) => ({
            ...prev,
            [slot.id]: { ...prev[slot.id], status: "done" },
          }));
        })
        .catch((e) => {
          // AI failure shouldn't kill the upload — the photo is saved either way
          setUploads((prev) => ({
            ...prev,
            [slot.id]: { ...prev[slot.id], status: "done" },
          }));
          console.warn("analyze-vehicle-damage failed (photo still saved):", e);
        });
    },
    [submissionToken, dealershipId, toast],
  );

  const handleClear = (slotId: string) => {
    setUploads((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    if (inputRefs.current[slotId]) inputRefs.current[slotId]!.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-success/10 border border-success/30 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-card-foreground text-base">
              Get a higher offer with AI condition scoring
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Upload a few photos and our AI verifies your car's actual condition.
              When the photos show better-than-stated condition, your offer goes up
              automatically — usually <strong>$300–$1,500</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-card-foreground">
          {requiredDone} of {requiredCount} required photos
          {totalDone > requiredDone && (
            <span className="text-muted-foreground"> · +{totalDone - requiredDone} bonus</span>
          )}
        </span>
        {!canContinue && (
          <span className="text-muted-foreground">
            Add the {requiredCount - requiredDone} required photo{requiredCount - requiredDone === 1 ? "" : "s"} to continue.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {slots.map((slot) => {
          const state = uploads[slot.id];
          const isUploading = state?.status === "uploading";
          const isAnalyzing = state?.status === "analyzing";
          const isDone = state?.status === "done";
          const isError = state?.status === "error";

          return (
            <div
              key={slot.id}
              className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                isDone
                  ? "border-success/40 bg-success/5"
                  : isError
                  ? "border-destructive/40 bg-destructive/5"
                  : slot.required
                  ? "border-primary/30 bg-card"
                  : "border-border bg-muted/30"
              }`}
            >
              {state?.url ? (
                <>
                  <img src={state.url} alt={slot.label} className="w-full aspect-[4/3] object-cover" />
                  <button
                    type="button"
                    onClick={() => handleClear(slot.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-foreground/70 text-background flex items-center justify-center hover:bg-foreground"
                    aria-label="Remove photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {(isUploading || isAnalyzing) && (
                    <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-1.5">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-[10px] font-semibold text-primary">
                        {isUploading ? "Uploading…" : "AI scoring…"}
                      </span>
                    </div>
                  )}
                  {isDone && (
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-success text-success-foreground flex items-center justify-center shadow-md">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRefs.current[slot.id]?.click()}
                  className="w-full aspect-[4/3] flex flex-col items-center justify-center text-center px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <Camera
                    className={`w-6 h-6 mb-1 ${slot.required ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="text-[11px] font-semibold text-card-foreground leading-tight">
                    {slot.label}
                    {slot.required && <span className="text-primary ml-0.5">*</span>}
                  </span>
                </button>
              )}
              <input
                ref={(el) => (inputRefs.current[slot.id] = el)}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(slot, file);
                }}
              />
              <div className="px-2 py-1.5 bg-card/80 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                  {slot.hint}
                </p>
              </div>
              {isError && (
                <div className="absolute inset-x-0 top-0 bg-destructive/90 text-destructive-foreground px-2 py-1 text-[10px] font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Try again
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Skip — use my self-reported condition
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            // Report the shot_id of every slot the customer actually finished
            // uploading. SellCarForm uses this to suppress only the
            // condition / history questions that the photos cover.
            const uploadedSlots = Object.entries(uploads)
              .filter(([, state]) => state.status === "done")
              .map(([slotId]) => slotId);
            onComplete({ uploadedSlots, aiAvailable: requiredDone >= requiredCount });
          }}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Continue with AI scoring
        </button>
      </div>
    </div>
  );
};

export default StepPhotos;

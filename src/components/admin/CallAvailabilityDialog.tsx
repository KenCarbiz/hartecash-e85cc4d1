import { useEffect, useState } from "react";
import { Loader2, Moon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userLabel: string;
  onSaved?: () => void;
}

interface FormState {
  dnd: boolean;
  quietStart: string;     // 'HH:MM' or ''
  quietEnd: string;       // 'HH:MM' or ''
  quietTz: string;
}

const EMPTY: FormState = { dnd: false, quietStart: "", quietEnd: "", quietTz: "America/New_York" };

/** Strips a Postgres `time` column to 'HH:MM'. Accepts null. */
function trimTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

/**
 * Per-rep click-to-dial availability editor. Sets DND + quiet-hours
 * window on `user_roles`. Edge function `twilio-click-to-dial` honors
 * these via `click_to_dial_rep_available()`.
 */
const CallAvailabilityDialog = ({ open, onOpenChange, userId, userLabel, onSaved }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("click_to_dial_dnd, click_to_dial_quiet_start, click_to_dial_quiet_end, click_to_dial_quiet_tz")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setForm({
        dnd: !!(data as { click_to_dial_dnd?: boolean })?.click_to_dial_dnd,
        quietStart: trimTime((data as { click_to_dial_quiet_start?: string })?.click_to_dial_quiet_start),
        quietEnd: trimTime((data as { click_to_dial_quiet_end?: string })?.click_to_dial_quiet_end),
        quietTz: (data as { click_to_dial_quiet_tz?: string })?.click_to_dial_quiet_tz || "America/New_York",
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const validateAndSave = async () => {
    const { quietStart, quietEnd } = form;
    const oneSet = !!quietStart !== !!quietEnd; // exactly one filled
    if (oneSet) {
      toast({
        title: "Quiet hours need both ends",
        description: "Set both start and end, or leave both blank to disable.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    // Schema-cache resilience — same pattern as AppearanceSettings.
    // 20260429140000_click_to_dial_v2 + the 20260429190000 heal both
    // add the click_to_dial_* columns, but environments where the
    // PostgREST cache is stale will reject the UPDATE with "Could
    // not find the 'X' column of 'user_roles'". Loop and strip
    // missing columns until either the update succeeds or we hit a
    // different error.
    const tryUpdate = async (payload: Record<string, unknown>) => {
      return supabase.from("user_roles").update(payload).eq("user_id", userId);
    };

    let payload: Record<string, unknown> = {
      click_to_dial_dnd: form.dnd,
      click_to_dial_quiet_start: form.quietStart || null,
      click_to_dial_quiet_end: form.quietEnd || null,
      click_to_dial_quiet_tz: (form.quietStart && form.quietEnd) ? form.quietTz : null,
    };
    const stripped: string[] = [];
    let result = await tryUpdate(payload);
    const maxAttempts = Object.keys(payload).length;
    let attempts = 0;
    while (
      result.error &&
      attempts < maxAttempts &&
      /Could not find the '([^']+)' column/.test(String(result.error.message || ""))
    ) {
      const m = String(result.error.message).match(/Could not find the '([^']+)' column/);
      const missingCol = m?.[1];
      if (!missingCol || !(missingCol in payload)) break;
      delete payload[missingCol];
      stripped.push(missingCol);
      attempts++;
      result = await tryUpdate(payload);
    }

    setSaving(false);
    if (result.error) {
      toast({ title: "Couldn't save", description: result.error.message, variant: "destructive" });
      return;
    }
    if (stripped.length > 0) {
      toast({
        title: "Saved (with caveat)",
        description: `Some availability fields couldn't be saved on this environment yet — ask the admin to apply migration 20260429190000_user_roles_heal_click_to_dial.sql. Skipped: ${stripped.join(", ")}.`,
      });
    } else {
      toast({ title: "Availability saved" });
    }
    onSaved?.();
    onOpenChange(false);
  };

  const showQuietTz = !!form.quietStart && !!form.quietEnd;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-primary" />
          Click-to-dial availability
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          When set, the bridge call refuses to ring {userLabel || "this rep"} and shows them a friendly message instead. Other channels (SMS, email) are unaffected.
        </DialogDescription>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <Label className="text-sm font-semibold">Do not disturb</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hard block — refuses every dial attempt regardless of time.
                </p>
              </div>
              <Switch
                checked={form.dnd}
                onCheckedChange={(v) => setForm((f) => ({ ...f, dnd: v }))}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold">Quiet hours</Label>
              <p className="text-xs text-muted-foreground">
                Soft block — refuses dials inside this local-time window. Leave blank to disable. Window may wrap midnight (e.g. 21:00 → 07:00).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Start</Label>
                  <Input
                    type="time"
                    value={form.quietStart}
                    onChange={(e) => setForm((f) => ({ ...f, quietStart: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">End</Label>
                  <Input
                    type="time"
                    value={form.quietEnd}
                    onChange={(e) => setForm((f) => ({ ...f, quietEnd: e.target.value }))}
                  />
                </div>
              </div>
              {showQuietTz && (
                <div>
                  <Label className="text-xs text-muted-foreground">Timezone</Label>
                  <Select
                    value={form.quietTz}
                    onValueChange={(v) => setForm((f) => ({ ...f, quietTz: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={validateAndSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CallAvailabilityDialog;

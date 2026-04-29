import { useEffect, useState } from "react";
import { Loader2, Moon, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];

interface FormState {
  phone: string;
  dnd: boolean;
  quietStart: string;
  quietEnd: string;
  quietTz: string;
}

const EMPTY: FormState = {
  phone: "",
  dnd: false,
  quietStart: "",
  quietEnd: "",
  quietTz: "America/New_York",
};

function trimTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length > 6) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length > 3) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length > 0) return `(${digits}`;
  return "";
}

/**
 * Self-serve availability page for reps. Lets them set their cell
 * phone + DND + quiet-hours window without an admin's help. Saves via
 * the `set_my_call_availability` SECURITY DEFINER RPC which only
 * touches safe-to-self-edit columns (no role / dealership_id).
 */
const MyAvailability = () => {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("phone, click_to_dial_dnd, click_to_dial_quiet_start, click_to_dial_quiet_end, click_to_dial_quiet_tz")
        .eq("user_id", u.user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const row = (data || {}) as {
        phone?: string;
        click_to_dial_dnd?: boolean;
        click_to_dial_quiet_start?: string;
        click_to_dial_quiet_end?: string;
        click_to_dial_quiet_tz?: string;
      };
      setForm({
        phone: formatPhoneInput(row.phone || ""),
        dnd: !!row.click_to_dial_dnd,
        quietStart: trimTime(row.click_to_dial_quiet_start),
        quietEnd: trimTime(row.click_to_dial_quiet_end),
        quietTz: row.click_to_dial_quiet_tz || "America/New_York",
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    const oneSet = !!form.quietStart !== !!form.quietEnd;
    if (oneSet) {
      toast({
        title: "Quiet hours need both ends",
        description: "Set both start and end, or leave both blank to disable.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const phoneDigits = form.phone.replace(/\D/g, "");
    const { error } = await supabase.rpc("set_my_call_availability", {
      p_phone: phoneDigits,
      p_dnd: form.dnd,
      p_quiet_start: form.quietStart || null,
      p_quiet_end: form.quietEnd || null,
      p_quiet_tz: form.quietStart && form.quietEnd ? form.quietTz : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showQuietTz = !!form.quietStart && !!form.quietEnd;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-bold">My</div>
        <h1 className="text-2xl font-bold mt-1">Availability</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Control how click-to-dial reaches you. These settings only affect bridged calls — SMS and email are unaffected.
        </p>
      </div>

      {/* Cell phone */}
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-bold text-base">Cell phone</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-1">
          When you click a customer's phone in a file, we ring this number first and then bridge you to the customer.
        </p>
        <Input
          type="tel"
          placeholder="(555) 123-4567"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
          className="max-w-xs"
        />
      </div>

      {/* DND */}
      <div className="bg-card border rounded-2xl p-5 flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-bold text-base">Do not disturb</h2>
            <Badge
              variant="outline"
              className={
                form.dnd
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }
            >
              {form.dnd ? "ON" : "OFF"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Hard block — refuses every dial attempt regardless of time. Use this when you're with a customer or off-shift.
          </p>
        </div>
        <Switch
          checked={form.dnd}
          onCheckedChange={(v) => setForm((f) => ({ ...f, dnd: v }))}
        />
      </div>

      {/* Quiet hours */}
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-base">Quiet hours</h2>
        <p className="text-sm text-muted-foreground -mt-1">
          Soft block — refuses dials inside this local-time window. Leave blank to disable. Window may wrap midnight (e.g. 21:00 → 07:00).
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
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
          <div className="max-w-md">
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

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
};

export default MyAvailability;

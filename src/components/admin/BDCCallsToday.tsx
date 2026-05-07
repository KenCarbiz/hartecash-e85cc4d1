import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Phone, Loader2, Clock, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

/**
 * BDC Calls Today — queue of follow-up calls the cadence engine queued
 * up because this dealership has voice_ai_enabled = false.
 *
 * Sort: priority (1=highest) first, then due_at ascending (most-overdue
 * up top). Hot leads + accepted-but-not-scheduled stalls auto-bump.
 *
 * On "Mark Called" the rep picks an outcome and the cadence engine
 * reacts: booked_appointment exits the cadence + creates the appt;
 * left_voicemail re-queues the SAME call in 48h; not_interested
 * routes to the reengage cadence with a 7-day cooldown.
 */
interface BDCTask {
  id: string;
  submission_id: string;
  cadence_state: string;
  cadence_step: number;
  intent: string;
  status: string;
  priority: number;
  due_at: string;
  rep_context: any;
  assigned_email: string | null;
  assigned_role: string | null;
}

const INTENT_LABEL: Record<string, string> = {
  voice_offer_re_engage: "Re-engage offer",
  voice_offer_refresh: "Refresh offer",
  voice_schedule_inspection: "Schedule inspection",
};

const OUTCOME_LABEL: Record<string, string> = {
  booked_appointment: "Booked appointment",
  re_quoted: "Re-quoted",
  customer_pushed_back: "Customer pushed back",
  left_voicemail: "Left voicemail",
  no_answer: "No answer",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
};

const dueLabel = (iso: string): { text: string; overdue: boolean } => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) {
    const overdueMin = Math.abs(Math.floor(ms / 60_000));
    if (overdueMin < 60) return { text: `${overdueMin}m overdue`, overdue: true };
    return { text: `${Math.floor(overdueMin / 60)}h overdue`, overdue: true };
  }
  const min = Math.floor(ms / 60_000);
  if (min < 60) return { text: `due in ${min}m`, overdue: false };
  return { text: `due in ${Math.floor(min / 60)}h`, overdue: false };
};

const BDCCallsToday = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<BDCTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<BDCTask | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [appointmentIso, setAppointmentIso] = useState("");
  const [reQuotedAmount, setReQuotedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bdc_call_tasks")
      .select("*")
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: true })
      .order("due_at", { ascending: true })
      .limit(100);
    if (error) {
      toast({ title: "Couldn't load calls", description: error.message, variant: "destructive" });
    }
    setTasks((data as BDCTask[] | null) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openOutcomeDialog = (task: BDCTask) => {
    setActiveTask(task);
    setOutcome("");
    setNotes("");
    setAppointmentIso("");
    setReQuotedAmount("");
  };

  const submitOutcome = async () => {
    if (!activeTask || !outcome) return;
    setSubmitting(true);
    try {
      const body: any = { task_id: activeTask.id, outcome, notes: notes.trim() || undefined };
      if (outcome === "booked_appointment" && appointmentIso) body.appointment_iso = appointmentIso;
      if (outcome === "re_quoted" && reQuotedAmount) body.re_quoted_amount = Number(reQuotedAmount);
      const { error } = await supabase.functions.invoke("complete-bdc-call", { body });
      if (error) throw error;
      toast({ title: "Call logged", description: OUTCOME_LABEL[outcome] || outcome });
      setActiveTask(null);
      void load();
    } catch (e: any) {
      toast({ title: "Couldn't save outcome", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calls Today</h1>
          <p className="text-sm text-muted-foreground">
            Cadence-queued follow-ups. Each one has talking points + your
            authorized bump amount baked in. Skip after 24h auto-expires.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {tasks && tasks.length === 0 && !loading && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <CheckCircle className="w-6 h-6 mx-auto mb-2 text-success" />
          No open calls. Nice.
        </Card>
      )}

      <div className="space-y-2">
        {tasks?.map((t) => {
          const ctx = t.rep_context || {};
          const customer = ctx.customer || {};
          const vehicle = ctx.vehicle || {};
          const offer = ctx.offer || {};
          const signals = ctx.signals || {};
          const due = dueLabel(t.due_at);
          const vehicleStr = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={t.priority <= 3 ? "destructive" : "secondary"} className="text-micro">
                      P{t.priority}
                    </Badge>
                    <Badge variant="outline" className="text-micro">
                      {INTENT_LABEL[t.intent] || t.intent}
                    </Badge>
                    <Badge variant="outline" className="text-micro">
                      cadence: {t.cadence_state} step {t.cadence_step}
                    </Badge>
                    {signals.decline_reason && (
                      <Badge variant="outline" className="text-micro border-amber-400 text-warning">
                        reason: {signals.decline_reason}
                      </Badge>
                    )}
                    <span className={`text-[11px] inline-flex items-center gap-1 ${due.overdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      {due.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {due.text}
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-base font-semibold">{customer.name || "Customer"}</span>
                    <a href={`tel:${customer.phone}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {customer.phone || "no phone"}
                    </a>
                    <span className="text-sm text-muted-foreground">— {vehicleStr}</span>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {offer.current != null && (
                      <span>Last offer <strong className="text-foreground">${Number(offer.current).toLocaleString()}</strong></span>
                    )}
                    {offer.max_quotable != null && (
                      <span>Authorized to <strong className="text-success dark:text-emerald-400">${Number(offer.max_quotable).toLocaleString()}</strong> ({offer.authorized_bump_pct}%)</span>
                    )}
                    {offer.acv_ceiling != null && (
                      <span>ACV ceiling <strong>${Number(offer.acv_ceiling).toLocaleString()}</strong></span>
                    )}
                    {signals.has_loan && (
                      <span className="text-warning">⚠ Lien w/ {signals.loan_company || "lender"}</span>
                    )}
                  </div>

                  {ctx.talking_points && (
                    <pre className="mt-3 text-caption bg-muted/40 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed">
                      {ctx.talking_points}
                    </pre>
                  )}
                </div>

                <Button onClick={() => openOutcomeDialog(t)} size="sm" className="shrink-0">
                  Mark Called
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!activeTask} onOpenChange={(o) => !o && setActiveTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Call outcome</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcome</label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pick the outcome" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {outcome === "booked_appointment" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appointment date / time</label>
                <Input
                  type="datetime-local"
                  value={appointmentIso}
                  onChange={(e) => setAppointmentIso(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {outcome === "re_quoted" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New offer amount</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 13500"
                  value={reQuotedAmount}
                  onChange={(e) => setReQuotedAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-micro text-muted-foreground">
                  If higher than the previous offer, the customer gets an "offer increased" SMS automatically.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
              <Textarea
                rows={3}
                placeholder="Anything the next person picking this up should know"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveTask(null)}>Cancel</Button>
            <Button onClick={submitOutcome} disabled={!outcome || submitting}>
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BDCCallsToday;

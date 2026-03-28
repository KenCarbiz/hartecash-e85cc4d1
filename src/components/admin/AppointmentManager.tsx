import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Eye, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Submission, DealerLocation } from "@/lib/adminConstants";
import { getTimeSlotsForDate, APPT_TIME_SLOTS_WEEKDAY, APPT_TIME_SLOTS_FRISSAT } from "@/lib/adminConstants";

interface AppointmentManagerProps {
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  submissions: Submission[];
  dealerLocations: DealerLocation[];
  onViewSubmission: (appt: Appointment) => void;
  fetchSubmissions: () => void;
  fetchAppointments: () => void;
}

const AppointmentManager = ({
  appointments,
  setAppointments,
  submissions,
  dealerLocations,
  onViewSubmission,
  fetchSubmissions,
  fetchAppointments,
}: AppointmentManagerProps) => {
  const { toast } = useToast();
  const [locationFilter, setLocationFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ preferred_date: "", preferred_time: "" });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", customer_email: "", customer_phone: "",
    preferred_date: "", preferred_time: "", store_location: "",
    vehicle_info: "", notes: "", submission_token: "",
  });

  const handleCreate = async () => {
    if (!form.customer_name || !form.customer_email || !form.customer_phone || !form.preferred_date || !form.preferred_time) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        customer_name: form.customer_name, customer_email: form.customer_email, customer_phone: form.customer_phone,
        preferred_date: form.preferred_date, preferred_time: form.preferred_time,
        store_location: form.store_location || null, vehicle_info: form.vehicle_info || null,
        notes: form.notes || null, submission_token: form.submission_token || null,
      } as any);
      if (error) throw error;
      if (form.submission_token) {
        await supabase.from("submissions").update({
          progress_status: "inspection_scheduled", status_updated_at: new Date().toISOString(),
          appointment_date: form.preferred_date, appointment_set: true,
        }).eq("token", form.submission_token);
        fetchSubmissions();
      }
      supabase.functions.invoke("notify-appointment", { body: { appointment: form } });
      supabase.functions.invoke("send-appointment-confirmation", { body: { appointment: form } });
      toast({ title: "Appointment created", description: `Scheduled for ${form.preferred_date} at ${form.preferred_time}.` });
      setShowCreate(false);
      setForm({ customer_name: "", customer_email: "", customer_phone: "", preferred_date: "", preferred_time: "", store_location: "", vehicle_info: "", notes: "", submission_token: "" });
      fetchAppointments();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      if (status === "Confirmed") {
        try { await supabase.functions.invoke("send-appointment-confirmation", { body: { appointment: appt } }); } catch {
          toast({ title: "Warning", description: "Status updated but confirmation email failed.", variant: "destructive" });
        }
      }
      toast({ title: "Updated", description: `Appointment marked as ${status}.` });
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleForm.preferred_date || !rescheduleForm.preferred_time) return;
    const { error } = await supabase.from("appointments").update({
      preferred_date: rescheduleForm.preferred_date, preferred_time: rescheduleForm.preferred_time,
    }).eq("id", rescheduleAppt.id);
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === rescheduleAppt.id ? { ...a, preferred_date: rescheduleForm.preferred_date, preferred_time: rescheduleForm.preferred_time } : a));
      toast({ title: "Rescheduled", description: "Appointment updated." });
      if (rescheduleAppt.submission_token) {
        const linkedSub = submissions.find(s => s.token === rescheduleAppt.submission_token);
        if (linkedSub) {
          const loc = dealerLocations.find(l => l.id === (rescheduleAppt.store_location || ""));
          supabase.functions.invoke("send-notification", {
            body: { trigger_key: "customer_appointment_rescheduled", submission_id: linkedSub.id, appointment_date: rescheduleForm.preferred_date, appointment_time: rescheduleForm.preferred_time, location: loc?.name || "" },
          }).catch(console.error);
        }
      } else if (rescheduleAppt.customer_email) {
        supabase.functions.invoke("send-reschedule-notification", {
          body: { appointment: { ...rescheduleAppt, new_date: rescheduleForm.preferred_date, new_time: rescheduleForm.preferred_time, old_date: rescheduleAppt.preferred_date, old_time: rescheduleAppt.preferred_time } },
        }).catch(console.error);
      }
      setRescheduleAppt(null);
    } else {
      toast({ title: "Error", description: "Failed to reschedule.", variant: "destructive" });
    }
  };

  const filteredAppointments = locationFilter === "all" ? appointments : appointments.filter(a => a.store_location === locationFilter);
  const getCreateTimeSlots = () => getTimeSlotsForDate(form.preferred_date);
  const getRescheduleTimeSlots = () => getTimeSlotsForDate(rescheduleForm.preferred_date);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-card-foreground">Scheduled Appointments</h2>
        <div className="flex items-center gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> New Appointment</Button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{appointments.length === 0 ? "No appointments scheduled yet." : "No appointments at this location."}</div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Time</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Customer</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Vehicle</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Location</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-sm">{new Date(appt.preferred_date + "T12:00:00").toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-sm">{appt.preferred_time}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-sm">{appt.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{appt.customer_email}</div>
                    </td>
                    <td className="px-3 py-2 text-sm">{appt.vehicle_info || "—"}</td>
                    <td className="px-3 py-2 text-sm">
                      <Select value={appt.store_location || "unset"} onValueChange={async (val) => {
                        const newLoc = val === "unset" ? null : val;
                        await supabase.from("appointments").update({ store_location: newLoc }).eq("id", appt.id);
                        setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, store_location: newLoc } : a));
                      }}>
                        <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unset">Not Set</SelectItem>
                          {dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={appt.status === "Confirmed" ? "default" : appt.status === "Completed" ? "secondary" : "outline"} className="text-xs">{appt.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {appt.submission_token && <Button size="sm" variant="ghost" title="View Customer" onClick={() => onViewSubmission(appt)}><Eye className="w-4 h-4" /></Button>}
                        <Button size="sm" variant="ghost" title="Reschedule" onClick={() => { setRescheduleAppt(appt); setRescheduleForm({ preferred_date: appt.preferred_date, preferred_time: appt.preferred_time }); }}>
                          <CalendarClock className="w-4 h-4" />
                        </Button>
                        {appt.status === "pending" && <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(appt.id, "Confirmed")}>Confirm</Button>}
                        {appt.status === "Confirmed" && <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(appt.id, "Completed")}>Complete</Button>}
                        <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate(appt.id, "Cancelled")} className="text-destructive">Cancel</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(open) => { if (!open) setRescheduleAppt(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reschedule Appointment</DialogTitle></DialogHeader>
          {rescheduleAppt && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Rescheduling for <strong>{rescheduleAppt.customer_name}</strong></p>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Date</label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={rescheduleForm.preferred_date} onChange={(e) => {
                  const d = e.target.value;
                  const day = new Date(d + "T12:00:00").getDay();
                  const slots = day === 0 ? [] : (day === 5 || day === 6) ? APPT_TIME_SLOTS_FRISSAT : APPT_TIME_SLOTS_WEEKDAY;
                  setRescheduleForm(prev => ({ preferred_date: d, preferred_time: slots.includes(prev.preferred_time) ? prev.preferred_time : "" }));
                }} />
              </div>
              {rescheduleForm.preferred_date && new Date(rescheduleForm.preferred_date + "T12:00:00").getDay() === 0 ? (
                <p className="text-sm text-destructive font-medium">Closed on Sundays. Pick another date.</p>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Time</label>
                  <Select value={rescheduleForm.preferred_time} onValueChange={(v) => setRescheduleForm(prev => ({ ...prev, preferred_time: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a time" /></SelectTrigger>
                    <SelectContent>{getRescheduleTimeSlots().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRescheduleAppt(null)}>Cancel</Button>
                <Button onClick={handleReschedule} disabled={!rescheduleForm.preferred_date || !rescheduleForm.preferred_time || new Date(rescheduleForm.preferred_date + "T12:00:00").getDay() === 0}>Save New Time</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Schedule an Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={form.customer_name} onChange={(e) => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Customer name" /></div>
              <div className="space-y-1.5"><Label>Phone *</Label><Input value={form.customer_phone} onChange={(e) => setForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="(555) 123-4567" /></div>
            </div>
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.customer_email} onChange={(e) => setForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="email@example.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date *</Label><Input type="date" min={new Date().toISOString().split("T")[0]} value={form.preferred_date} onChange={(e) => setForm(p => ({ ...p, preferred_date: e.target.value, preferred_time: "" }))} /></div>
              <div className="space-y-1.5">
                <Label>Time *</Label>
                {form.preferred_date && new Date(form.preferred_date + "T12:00:00").getDay() === 0 ? (
                  <p className="text-sm text-destructive font-medium py-2">Closed Sundays</p>
                ) : (
                  <Select value={form.preferred_time} onValueChange={(v) => setForm(p => ({ ...p, preferred_time: v }))} disabled={!form.preferred_date}>
                    <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                    <SelectContent>{getCreateTimeSlots().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Link to Submission (optional)</Label>
              <Select value={form.submission_token} onValueChange={(v) => setForm(p => ({ ...p, submission_token: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a submission" /></SelectTrigger>
                <SelectContent>
                  {submissions.map(s => <SelectItem key={s.token} value={s.token}>{s.name || "Unknown"} — {[s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "No vehicle"}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Linking will update status to "Inspection Scheduled".</p>
            </div>
            <div className="space-y-1.5">
              <Label>Store Location</Label>
              <Select value={form.store_location} onValueChange={(v) => setForm(p => ({ ...p, store_location: v }))}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Vehicle Info</Label><Input value={form.vehicle_info} onChange={(e) => setForm(p => ({ ...p, vehicle_info: e.target.value }))} placeholder="e.g. 2020 Toyota Camry" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={2} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create Appointment"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentManager;

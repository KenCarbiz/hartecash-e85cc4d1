import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, MessageSquare, CheckCircle, XCircle, Clock, Send } from "lucide-react";

interface FollowUpRecord {
  id: string;
  submission_id: string;
  touch_number: number;
  channel: string;
  status: string;
  error_message: string | null;
  triggered_by: string | null;
  created_at: string;
  submission?: {
    name: string | null;
    vehicle_year: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    email: string | null;
    phone: string | null;
  };
}

const TOUCH_LABELS: Record<number, string> = {
  1: "Gentle Nudge",
  2: "Value Add",
  3: "Last Chance",
};

const FollowUpLog = () => {
  const [records, setRecords] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [touchFilter, setTouchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: followUps } = await supabase
      .from("follow_ups")
      .select("*")
      .order("created_at", { ascending: false });

    if (!followUps || followUps.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const subIds = [...new Set(followUps.map((f) => f.submission_id))];
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, name, vehicle_year, vehicle_make, vehicle_model, email, phone")
      .in("id", subIds);

    const subMap = new Map((subs || []).map((s) => [s.id, s]));

    setRecords(
      followUps.map((f) => ({
        ...f,
        submission: subMap.get(f.submission_id) || undefined,
      }))
    );
    setLoading(false);
  };

  const filtered = records.filter((r) => {
    if (touchFilter !== "all" && r.touch_number !== Number(touchFilter)) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const statusIcon = (status: string) => {
    if (status === "sent") return <CheckCircle className="w-3.5 h-3.5 text-success" />;
    if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">Loading follow-up activity…</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Send className="w-5 h-5" /> Follow-Up Activity
        </h2>
        <span className="text-sm text-muted-foreground">{filtered.length} records</span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={touchFilter} onValueChange={setTouchFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Touch #" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Touches</SelectItem>
            <SelectItem value="1">Touch 1 — Nudge</SelectItem>
            <SelectItem value="2">Touch 2 — Value Add</SelectItem>
            <SelectItem value="3">Touch 3 — Last Chance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No follow-up records found.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Vehicle</TableHead>
                <TableHead className="text-xs">Touch</TableHead>
                <TableHead className="text-xs">Channel</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Triggered By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}{" "}
                    <span className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{r.submission?.name || "—"}</div>
                    <div className="text-muted-foreground">
                      {r.submission?.email || r.submission?.phone || ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.submission
                      ? `${r.submission.vehicle_year || ""} ${r.submission.vehicle_make || ""} ${r.submission.vehicle_model || ""}`.trim() || "—"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {r.touch_number} — {TOUCH_LABELS[r.touch_number] || `Touch ${r.touch_number}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                      {r.channel === "email" ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                      {r.channel}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                      {statusIcon(r.status)}
                      {r.status}
                    </span>
                    {r.error_message && (
                      <p className="text-destructive text-[10px] mt-0.5 max-w-[200px] truncate" title={r.error_message}>
                        {r.error_message}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">
                    {r.triggered_by || "auto"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default FollowUpLog;

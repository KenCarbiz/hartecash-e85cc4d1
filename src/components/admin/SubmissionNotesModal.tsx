import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SubmissionNote {
  id: string;
  submission_id: string;
  body: string;
  author: string | null;
  created_at: string;
}

const fmtNoteTime = (iso: string): string => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// True when the supabase error indicates the submission_notes table itself
// is missing on this database. We treat that as "feature not provisioned"
// (return [] for reads, friendlier toast for writes) instead of crashing.
const isMissingTableError = (err: { message?: string; code?: string } | null): boolean => {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("submission_notes") && (
    msg.includes("could not find") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    err.code === "42P01" || err.code === "PGRST205"
  );
};

export const fetchSubmissionNotes = async (submissionId: string): Promise<SubmissionNote[]> => {
  const { data, error } = await (supabase as never as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: string) => {
          order: (c: string, o: { ascending: boolean }) => Promise<{ data: SubmissionNote[] | null; error: { message: string; code?: string } | null }>;
        };
      };
    };
  })
    .from("submission_notes")
    .select("id, submission_id, body, author, created_at")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error)) {
      // Migration not applied yet on this database — fail soft.
      // eslint-disable-next-line no-console
      console.warn("[notes] submission_notes table missing — apply migration 20260427100000_add_submission_notes.sql");
      return [];
    }
    throw new Error(error.message);
  }
  return data || [];
};

interface NotesModalProps {
  submissionId: string;
  customerName: string | null;
  open: boolean;
  onClose: () => void;
  author: string;
  onChange?: () => void;
}

const SubmissionNotesModal = ({ submissionId, customerName, open, onClose, author, onChange }: NotesModalProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<SubmissionNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchSubmissionNotes(submissionId)
      .then((rows) => { if (!cancelled) setNotes(rows); })
      .catch((e) => { if (!cancelled) toast({ title: "Couldn't load notes", description: e.message, variant: "destructive" }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, submissionId, toast]);

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    const { data, error } = await (supabase as never as {
      from: (t: string) => {
        insert: (rows: unknown) => {
          select: (s: string) => {
            single: () => Promise<{ data: SubmissionNote | null; error: { message: string; code?: string } | null }>;
          };
        };
      };
    })
      .from("submission_notes")
      .insert({ submission_id: submissionId, body, author })
      .select("id, submission_id, body, author, created_at")
      .single();
    setSaving(false);
    if (error || !data) {
      if (isMissingTableError(error)) {
        toast({
          title: "Notes feature isn't ready yet",
          description: "The submission_notes table hasn't been created on this database. Run the pending migration in Supabase Studio → SQL Editor: 20260427100000_add_submission_notes.sql",
          variant: "destructive",
        });
      } else {
        toast({ title: "Couldn't save note", description: error?.message ?? "Unknown error", variant: "destructive" });
      }
      return;
    }
    setNotes((prev) => [data, ...prev]);
    setDraft("");
    onChange?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">Internal Notes</div>
            <div className="font-display text-[20px] leading-tight mt-0.5 truncate max-w-[360px]">
              {customerName || "Customer File"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 4.9a1 1 0 011.4 0L10 7.2l2.3-2.3a1 1 0 011.4 1.4L11.4 8.6l2.3 2.3a1 1 0 01-1.4 1.4L10 10l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 8.6 6.3 6.3a1 1 0 010-1.4z"/></svg>
          </button>
        </div>

        {/* Composer */}
        <div className="px-5 py-4 border-b border-slate-100">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleAdd(); }
            }}
            placeholder="Add an internal note…"
            rows={3}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-400">⌘/Ctrl + Enter to save</span>
            <button
              onClick={handleAdd}
              disabled={!draft.trim() || saving}
              className="h-9 px-4 rounded-lg bg-[#003b80] hover:bg-[#002a5c] disabled:bg-slate-300 text-white text-[13px] font-bold transition"
            >
              {saving ? "Saving…" : "Add Note"}
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-400 text-center py-6">Loading notes…</div>
          ) : notes.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">No notes yet — add the first one above.</div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[12px] font-bold text-slate-900">{n.author || "Staff"}</span>
                  <span className="text-[11px] text-slate-400">{fmtNoteTime(n.created_at)}</span>
                </div>
                <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionNotesModal;

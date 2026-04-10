import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

interface ChangelogEntry {
  id: string;
  entry_date: string;
  title: string;
  description: string;
  items: string[];
  icon: string;
  tag: string;
  sort_order: number;
  is_active: boolean;
}

const ICON_OPTIONS = [
  "Sparkles", "Shield", "Bell", "BarChart3", "Wrench", "Camera", "FileText",
  "Users", "DollarSign", "CheckCircle", "Eye", "Handshake", "ClipboardCheck",
  "ScanLine", "ImagePlus", "Loader", "SplitSquareHorizontal", "MessageSquare",
  "Star", "MapPin", "Smartphone", "CalendarDays", "Layout", "Globe", "Moon",
  "Zap", "QrCode", "Database", "ClipboardList", "FormInput", "Layers", "Car", "Palette",
];

const TAG_OPTIONS = [
  { value: "feature", label: "New Feature" },
  { value: "improvement", label: "Improvement" },
  { value: "fix", label: "Bug Fix" },
  { value: "security", label: "Security" },
];

const TAG_COLORS: Record<string, string> = {
  feature: "bg-accent/15 text-accent",
  improvement: "bg-primary/15 text-primary",
  fix: "bg-orange-500/15 text-orange-600",
  security: "bg-emerald-500/15 text-emerald-600",
};

const emptyEntry = {
  entry_date: new Date().toISOString().slice(0, 10),
  title: "",
  description: "",
  items: [] as string[],
  icon: "Sparkles",
  tag: "feature",
  sort_order: 0,
  is_active: true,
};

export default function ChangelogManagement() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [form, setForm] = useState(emptyEntry);
  const [itemsText, setItemsText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from("changelog_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("sort_order", { ascending: true });
    setEntries((data as ChangelogEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyEntry);
    setItemsText("");
    setDialogOpen(true);
  };

  const openEdit = (entry: ChangelogEntry) => {
    setEditing(entry);
    setForm({
      entry_date: entry.entry_date,
      title: entry.title,
      description: entry.description,
      items: entry.items,
      icon: entry.icon,
      tag: entry.tag,
      sort_order: entry.sort_order,
      is_active: entry.is_active,
    });
    setItemsText(entry.items.join("\n"));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const items = itemsText.split("\n").map(s => s.trim()).filter(Boolean);
    const payload = { ...form, items };

    if (editing) {
      const { error } = await supabase
        .from("changelog_entries")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Error updating entry", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Entry updated" });
      }
    } else {
      const { error } = await supabase
        .from("changelog_entries")
        .insert(payload);
      if (error) {
        toast({ title: "Error creating entry", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Entry created" });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchEntries();
  };

  const toggleActive = async (entry: ChangelogEntry) => {
    await supabase
      .from("changelog_entries")
      .update({ is_active: !entry.is_active })
      .eq("id", entry.id);
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this changelog entry permanently?")) return;
    await supabase.from("changelog_entries").delete().eq("id", id);
    fetchEntries();
    toast({ title: "Entry deleted" });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Changelog Entries</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Add Entry
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Title</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Tag</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Items</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className={`border-t border-border ${!entry.is_active ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{entry.entry_date}</td>
                <td className="px-3 py-2 font-medium truncate max-w-[200px]">{entry.title}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TAG_COLORS[entry.tag] || ""}`}>
                    {TAG_OPTIONS.find(t => t.value === entry.tag)?.label || entry.tag}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{entry.items.length}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(entry)}>
                      {entry.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEntry(entry.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Entry" : "New Changelog Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tag</label>
                <Select value={form.tag} onValueChange={(v) => setForm({ ...form, tag: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAG_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Feature name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="One-line summary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Icon</label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sort Order</label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Bullet Items (one per line)</label>
              <Textarea
                rows={8}
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder="Each line becomes a bullet point"
              />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update Entry" : "Create Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

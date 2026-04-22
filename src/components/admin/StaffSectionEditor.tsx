import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2, Copy } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ALL_SECTIONS, SECTION_GROUPS } from "@/components/admin/PermissionManagement";

interface PermissionGroup {
  id: string;
  name: string;
  allowed_sections: string[];
}

interface StaffSectionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  currentSections: string[];
  groups: PermissionGroup[];
  onSave: (sections: string[]) => void | Promise<void>;
  title?: string;
}

const StaffSectionEditor = ({
  open, onOpenChange, staffName, currentSections, groups, onSave, title,
}: StaffSectionEditorProps) => {
  const [sections, setSections] = useState<string[]>([...currentSections]);
  const [saving, setSaving] = useState(false);

  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const selectAllInGroup = (groupLabel: string) => {
    const keys = ALL_SECTIONS.filter((s) => s.group === groupLabel).map((s) => s.key);
    const allSelected = keys.every((k) => sections.includes(k));
    if (allSelected) {
      setSections((prev) => prev.filter((s) => !keys.includes(s)));
    } else {
      setSections((prev) => [...new Set([...prev, ...keys])]);
    }
  };

  const applyGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      setSections((prev) => [...new Set([...prev, ...group.allowed_sections])]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(sections);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || `Manage Access — ${staffName}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick-apply from group template */}
          {groups.length > 0 && (
            <div className="flex items-center gap-2">
              <Select onValueChange={applyGroup}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Apply from template group…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <Copy className="w-3 h-3 inline mr-1.5" />
                      {g.name} ({g.allowed_sections.length} sections)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setSections([])}
              >
                Clear All
              </Button>
            </div>
          )}

          {/* Section toggles */}
          <div className="space-y-3">
            {SECTION_GROUPS.map((groupLabel) => {
              const secs = ALL_SECTIONS.filter((s) => s.group === groupLabel);
              const allChecked = secs.every((s) => sections.includes(s.key));
              const someChecked = secs.some((s) => sections.includes(s.key));
              return (
                <div key={groupLabel} className="bg-muted/30 rounded-lg p-3">
                  <button
                    type="button"
                    onClick={() => selectAllInGroup(groupLabel)}
                    className="flex items-center gap-2 text-xs font-bold text-foreground/70 uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                  >
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={() => selectAllInGroup(groupLabel)}
                    />
                    {groupLabel}
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    {secs.map((s) => (
                      <label
                        key={s.key}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                      >
                        <Checkbox
                          checked={sections.includes(s.key)}
                          onCheckedChange={() => toggleSection(s.key)}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            {sections.length} of {ALL_SECTIONS.length} sections enabled
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffSectionEditor;

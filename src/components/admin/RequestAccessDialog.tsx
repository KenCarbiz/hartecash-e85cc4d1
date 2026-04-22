import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PermissionGroup {
  id: string;
  name: string;
  description: string;
}

interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const RequestAccessDialog = ({ open, onOpenChange, userId }: RequestAccessDialogProps) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("permission_groups" as any)
      .select("id, name, description")
      .order("name")
      .then(({ data }) => {
        setGroups((data as any[] || []) as PermissionGroup[]);
        setLoading(false);
      });
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedGroup) return;
    setSubmitting(true);

    const { error } = await supabase.from("permission_access_requests" as any).insert({
      user_id: userId,
      requested_group_id: selectedGroup,
      message: message.trim(),
    } as any);

    if (error) {
      if (error.message.includes("duplicate")) {
        toast({ title: "Already requested", description: "You've already submitted a request for this group.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Request submitted", description: "An admin will review your request." });

      // Notify admins via email (best-effort)
      try {
        await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "permission_request",
            data: { user_id: userId, group_name: groups.find(g => g.id === selectedGroup)?.name },
          },
        });
      } catch {
        // Non-critical
      }

      setSelectedGroup("");
      setMessage("");
      onOpenChange(false);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Request Access
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Permission Group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a permission group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div>
                        <span className="font-medium">{g.name}</span>
                        {g.description && (
                          <span className="text-xs text-muted-foreground ml-2">— {g.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Why do you need this access?"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedGroup} className="gap-1.5">
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestAccessDialog;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Network, CheckCircle2, Loader2 } from "lucide-react";

type Group = { id: string; slug: string; name: string; display_name: string | null };

interface Props {
  dealershipId: string;
  /** When false (single_store / multi_location architecture) the
   *  component renders nothing — only Dealer Group customers need
   *  to claim a group. */
  enabled: boolean;
  /** Disabled state during read-only or save-in-progress. */
  disabled?: boolean;
}

/**
 * Onboarding helper: lets a dealer who picked the "Dealer Group"
 * architecture either claim an existing group OR request that one
 * be created. The actual creation / attachment is handled by a
 * platform admin via Group Management — this is the dealer-facing
 * intake side.
 *
 * When the dealer claims an existing group, we set
 * dealer_accounts.dealer_group_id directly. Listing groups is
 * possible because dealer_groups RLS allows SELECT for any
 * authenticated user when they're a member (and during
 * onboarding the platform admin would attach the dealership
 * separately). For the request-new path we leave a row in
 * dealer_groups with status='pilot' for a platform admin to
 * approve and finalize the master MSA on.
 */
const OnboardingGroupClaim = ({ dealershipId, enabled, disabled }: Props) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestNew, setRequestNew] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [groupsRes, accountRes] = await Promise.all([
        supabase
          .from("dealer_groups")
          .select("id, slug, name, display_name")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("dealer_accounts")
          .select("dealer_group_id")
          .eq("dealership_id", dealershipId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setGroups((groupsRes.data as Group[]) ?? []);
      setCurrentGroupId(((accountRes.data as any)?.dealer_group_id) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealershipId, enabled]);

  if (!enabled) return null;

  const claim = async (groupId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("dealer_accounts")
      .update({ dealer_group_id: groupId })
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't attach to group", description: error.message, variant: "destructive" });
      return;
    }
    setCurrentGroupId(groupId);
    toast({ title: "Attached to group", description: "Your master MSA + per-rooftop activations are now managed at the group level." });
  };

  const detach = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("dealer_accounts")
      .update({ dealer_group_id: null })
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't detach", description: error.message, variant: "destructive" });
      return;
    }
    setCurrentGroupId(null);
    toast({ title: "Detached from group" });
  };

  const requestGroup = async () => {
    if (newName.trim().length < 3) {
      toast({ title: "Name too short", variant: "destructive" });
      return;
    }
    setSaving(true);
    // Create the group with status='pilot' — a platform admin will
    // finalize and sign the master MSA. Slug is auto-derived from
    // the name; collisions are surfaced as save errors so the user
    // can retry with a different name.
    const slug = newName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60);
    const { data: created, error: createErr } = await supabase
      .from("dealer_groups")
      .insert({
        slug,
        name: newName.trim(),
        display_name: newName.trim(),
        status: "pilot",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      setSaving(false);
      toast({ title: "Couldn't create group", description: createErr?.message ?? "unknown", variant: "destructive" });
      return;
    }
    // Auto-attach the requesting dealership to the new group.
    const { error: attachErr } = await supabase
      .from("dealer_accounts")
      .update({ dealer_group_id: (created as any).id })
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (attachErr) {
      toast({ title: "Group created, attach failed", description: attachErr.message, variant: "destructive" });
      return;
    }
    setCurrentGroupId((created as any).id);
    setRequestNew(false);
    setNewName("");
    toast({
      title: "Group requested",
      description: "A platform admin will finalize the master MSA. You're attached as the founding rooftop.",
    });
  };

  const currentGroup = groups.find((g) => g.id === currentGroupId);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Are you part of a dealer group?</h3>
            <p className="text-xs text-muted-foreground">
              Groups share a master MSA. Each rooftop activates beneath it with a 30-day pilot.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading groups…
          </div>
        ) : currentGroupId && currentGroup ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-900">
                Attached to {currentGroup.display_name || currentGroup.name}
              </span>
              <Badge variant="outline" className="text-micro font-mono">{currentGroup.slug}</Badge>
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-xs text-muted-foreground p-0 h-auto mt-1"
              onClick={detach}
              disabled={saving || disabled}
            >
              Detach (run as independent instead)
            </Button>
          </div>
        ) : requestNew ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Group name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Lithia Auto Group"
                disabled={saving || disabled}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                We'll create the group in pilot status. A platform admin will finalize and sign the master MSA, then you're attached as the founding rooftop.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={requestGroup} disabled={saving || disabled || newName.trim().length < 3} size="sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Create group
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRequestNew(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Pick your group</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value=""
                onChange={(e) => { if (e.target.value) claim(e.target.value); }}
                disabled={saving || disabled || groups.length === 0}
              >
                <option value="">— select an existing group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.display_name || g.name} ({g.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Don't see your group?</span>
              <Button
                variant="link"
                size="sm"
                className="text-xs p-0 h-auto"
                onClick={() => setRequestNew(true)}
                disabled={saving || disabled}
              >
                Request a new one
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OnboardingGroupClaim;

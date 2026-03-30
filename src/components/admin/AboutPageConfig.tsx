import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Plus, Trash2, ChevronDown, GripVertical, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Milestone {
  year: string;
  label: string;
}

interface ValueItem {
  icon: string;
  title: string;
  text: string;
}

const ICON_OPTIONS = [
  { value: "HandshakeIcon", label: "Handshake" },
  { value: "Shield", label: "Shield" },
  { value: "Clock", label: "Clock" },
  { value: "Award", label: "Award" },
  { value: "Heart", label: "Heart" },
  { value: "Star", label: "Star" },
  { value: "CheckCircle", label: "Check Circle" },
  { value: "Users", label: "Users" },
  { value: "Zap", label: "Zap" },
  { value: "Target", label: "Target" },
  { value: "Smile", label: "Smile" },
  { value: "ThumbsUp", label: "Thumbs Up" },
];

const AboutPageConfig = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [heroHeadline, setHeroHeadline] = useState("Four Generations. One Promise.");
  const [heroSubtext, setHeroSubtext] = useState("");
  const [story, setStory] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [values, setValues] = useState<ValueItem[]>([]);

  const [heroOpen, setHeroOpen] = useState(true);
  const [storyOpen, setStoryOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);

  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  useEffect(() => {
    supabase
      .from("site_config")
      .select("about_hero_headline, about_hero_subtext, about_story, about_milestones, about_values")
      .eq("dealership_id", dealershipId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setHeroHeadline(d.about_hero_headline || "");
          setHeroSubtext(d.about_hero_subtext || "");
          setStory(d.about_story || "");
          setMilestones(Array.isArray(d.about_milestones) ? d.about_milestones : []);
          setValues(Array.isArray(d.about_values) ? d.about_values : []);
        }
        setLoading(false);
      });
  }, [dealershipId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        about_hero_headline: heroHeadline,
        about_hero_subtext: heroSubtext,
        about_story: story,
        about_milestones: milestones,
        about_values: values,
      } as any)
      .eq("dealership_id", dealershipId);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "About page updated" });
    }
    setSaving(false);
  };

  const addMilestone = () => setMilestones([...milestones, { year: "", label: "" }]);
  const removeMilestone = (i: number) => setMilestones(milestones.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, field: keyof Milestone, val: string) => {
    const updated = [...milestones];
    updated[i] = { ...updated[i], [field]: val };
    setMilestones(updated);
  };

  const addValue = () => setValues([...values, { icon: "Shield", title: "", text: "" }]);
  const removeValue = (i: number) => setValues(values.filter((_, idx) => idx !== i));
  const updateValue = (i: number, field: keyof ValueItem, val: string) => {
    const updated = [...values];
    updated[i] = { ...updated[i], [field]: val };
    setValues(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading About page config…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">About Page</h2>
          <p className="text-xs text-muted-foreground">Customize the /about page content for your dealership.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href="/about" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </a>
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Hero */}
      <Collapsible open={heroOpen} onOpenChange={setHeroOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${heroOpen ? "" : "-rotate-90"}`} />
          <span className="font-semibold text-sm">Hero Section</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3 px-1">
          <div>
            <Label className="text-xs">Headline</Label>
            <Input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} placeholder="Four Generations. One Promise." />
          </div>
          <div>
            <Label className="text-xs">Subtext</Label>
            <Textarea value={heroSubtext} onChange={(e) => setHeroSubtext(e.target.value)} rows={3} placeholder="Brief intro paragraph…" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Story */}
      <Collapsible open={storyOpen} onOpenChange={setStoryOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${storyOpen ? "" : "-rotate-90"}`} />
          <span className="font-semibold text-sm">Our Story</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3 px-1">
          <div>
            <Label className="text-xs">Story Content (HTML supported)</Label>
            <Textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={12}
              placeholder="Write your dealership's story here. You can use <strong>, <em>, <br> tags for formatting."
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave blank to use the default Harte story. Supports basic HTML tags for formatting.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Milestones */}
      <Collapsible open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${milestonesOpen ? "" : "-rotate-90"}`} />
          <span className="font-semibold text-sm">Timeline Milestones</span>
          <span className="text-[10px] text-muted-foreground ml-auto mr-2">{milestones.length} items</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3 px-1">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-2 bg-card border border-border rounded-lg p-3">
              <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
              <div className="flex-1 space-y-2">
                <Input
                  value={m.year}
                  onChange={(e) => updateMilestone(i, "year", e.target.value)}
                  placeholder="Year (e.g. 1951, 2020s, Today)"
                  className="text-xs h-8"
                />
                <Textarea
                  value={m.label}
                  onChange={(e) => updateMilestone(i, "label", e.target.value)}
                  placeholder="Description of this milestone"
                  rows={2}
                  className="text-xs"
                />
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-destructive" onClick={() => removeMilestone(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addMilestone} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Milestone
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Values */}
      <Collapsible open={valuesOpen} onOpenChange={setValuesOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${valuesOpen ? "" : "-rotate-90"}`} />
          <span className="font-semibold text-sm">Values / Differentiators</span>
          <span className="text-[10px] text-muted-foreground ml-auto mr-2">{values.length} items</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3 px-1">
          {values.map((v, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Select value={v.icon} onValueChange={(val) => updateValue(i, "icon", val)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={v.title}
                  onChange={(e) => updateValue(i, "title", e.target.value)}
                  placeholder="Value title"
                  className="flex-1 text-xs h-8"
                />
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-destructive" onClick={() => removeValue(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Textarea
                value={v.text}
                onChange={(e) => updateValue(i, "text", e.target.value)}
                placeholder="Description of this value"
                rows={2}
                className="text-xs"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addValue} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Value
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AboutPageConfig;

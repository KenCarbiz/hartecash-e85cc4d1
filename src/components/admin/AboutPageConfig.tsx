import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Plus, Trash2, ChevronDown, GripVertical, ExternalLink, Building2, ImagePlus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Milestone {
  year: string;
  label: string;
}

interface ValueItem {
  icon: string;
  title: string;
  text: string;
}

interface LocationAbout {
  id: string;
  name: string;
  use_corporate_about: boolean;
  about_hero_headline: string;
  about_hero_subtext: string;
  about_story: string;
  about_image_url: string;
  about_image_urls: string[];
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

  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubtext, setHeroSubtext] = useState("");
  const [story, setStory] = useState("");
  const [aboutImageUrl, setAboutImageUrl] = useState("");
  const [aboutImageUrls, setAboutImageUrls] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [values, setValues] = useState<ValueItem[]>([]);

  const [heroOpen, setHeroOpen] = useState(true);
  const [storyOpen, setStoryOpen] = useState(true);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);

  const [locations, setLocations] = useState<LocationAbout[]>([]);
  const [savingLoc, setSavingLoc] = useState<string | null>(null);

  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  useEffect(() => {
    const load = async () => {
      const [configRes, locsRes] = await Promise.all([
        supabase
          .from("site_config")
          .select("about_hero_headline, about_hero_subtext, about_story, about_milestones, about_values, about_image_url, about_image_urls")
          .eq("dealership_id", dealershipId)
          .maybeSingle(),
        supabase
          .from("dealership_locations")
          .select("id, name, use_corporate_about, about_hero_headline, about_hero_subtext, about_story, about_image_url, about_image_urls")
          .eq("dealership_id", dealershipId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (configRes.data) {
        const d = configRes.data as any;
        setHeroHeadline(d.about_hero_headline || "");
        setHeroSubtext(d.about_hero_subtext || "");
        setStory(d.about_story || "");
        setAboutImageUrl(d.about_image_url || "");
        const urls = Array.isArray((d as any).about_image_urls) ? (d as any).about_image_urls : [];
        setAboutImageUrls(urls.length > 0 ? urls : (d.about_image_url ? [d.about_image_url] : []));
        setMilestones(Array.isArray(d.about_milestones) ? d.about_milestones : []);
        setValues(Array.isArray(d.about_values) ? d.about_values : []);
      }

      if (locsRes.data && locsRes.data.length > 0) {
        setLocations(
          (locsRes.data as any[]).map((l) => ({
            id: l.id,
            name: l.name,
            use_corporate_about: l.use_corporate_about ?? true,
            about_hero_headline: l.about_hero_headline || "",
            about_hero_subtext: l.about_hero_subtext || "",
            about_story: l.about_story || "",
            about_image_url: l.about_image_url || "",
            about_image_urls: Array.isArray(l.about_image_urls) && l.about_image_urls.length > 0
              ? l.about_image_urls
              : (l.about_image_url ? [l.about_image_url] : []),
          }))
        );
      }

      setLoading(false);
    };
    load();
  }, [dealershipId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        about_hero_headline: heroHeadline,
        about_hero_subtext: heroSubtext,
        about_story: story,
        about_image_url: aboutImageUrls[0] || null,
        about_image_urls: aboutImageUrls,
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

  const handleSaveLocation = async (loc: LocationAbout) => {
    setSavingLoc(loc.id);
    const { error } = await supabase
      .from("dealership_locations")
      .update({
        use_corporate_about: loc.use_corporate_about,
        about_hero_headline: loc.about_hero_headline || null,
        about_hero_subtext: loc.about_hero_subtext || null,
        about_story: loc.about_story || null,
        about_image_url: loc.about_image_urls[0] || null,
        about_image_urls: loc.about_image_urls || [],
      } as any)
      .eq("id", loc.id);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${loc.name} About Us updated` });
    }
    setSavingLoc(null);
  };

  const updateLocation = (id: string, field: keyof LocationAbout, value: any) => {
    setLocations((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
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

  const handleImageUpload = async (file: File, onUrl: (url: string) => void) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `about/${dealershipId}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("dealer-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("dealer-logos").getPublicUrl(path);
    onUrl(urlData.publicUrl);
    toast({ title: "Uploaded", description: "Image uploaded — save to apply." });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading About page config…
      </div>
    );
  }

  const hasMultipleLocations = locations.length > 1;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">About Page</h2>
          <p className="text-xs text-muted-foreground">Customize the /about page content for your dealership.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open("/about", "_blank")}>
            <ExternalLink className="w-3.5 h-3.5" /> Preview
          </Button>
        </div>
      </div>

      {hasMultipleLocations ? (
        <Tabs defaultValue="corporate" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="corporate" className="gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Corporate
            </TabsTrigger>
            {locations.map((loc) => (
              <TabsTrigger key={loc.id} value={loc.id}>{loc.name}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="corporate">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Corporate About
                </Button>
              </div>
              <CorporateAboutFields
                heroHeadline={heroHeadline} setHeroHeadline={setHeroHeadline}
                heroSubtext={heroSubtext} setHeroSubtext={setHeroSubtext}
                story={story} setStory={setStory}
                imageUrls={aboutImageUrls} setImageUrls={setAboutImageUrls}
                onImageUpload={(file) => handleImageUpload(file, (url) => setAboutImageUrls(prev => [...prev, url]))}
                milestones={milestones} setMilestones={setMilestones}
                values={values} setValues={setValues}
                heroOpen={heroOpen} setHeroOpen={setHeroOpen}
                storyOpen={storyOpen} setStoryOpen={setStoryOpen}
                milestonesOpen={milestonesOpen} setMilestonesOpen={setMilestonesOpen}
                valuesOpen={valuesOpen} setValuesOpen={setValuesOpen}
                addMilestone={addMilestone} removeMilestone={removeMilestone} updateMilestone={updateMilestone}
                addValue={addValue} removeValue={removeValue} updateValue={updateValue}
              />
            </div>
          </TabsContent>

          {locations.map((loc) => (
            <TabsContent key={loc.id} value={loc.id}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={loc.use_corporate_about}
                      onCheckedChange={(v) => updateLocation(loc.id, "use_corporate_about", v)}
                    />
                    <Label className="text-sm">Use corporate About Us</Label>
                  </div>
                  <Button
                    onClick={() => handleSaveLocation(loc)}
                    disabled={savingLoc === loc.id}
                    size="sm"
                    className="gap-1.5"
                  >
                    {savingLoc === loc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </Button>
                </div>

                {loc.use_corporate_about ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    This store uses the corporate About Us content. Toggle off to write a custom About Us for <strong>{loc.name}</strong>.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Headline</Label>
                      <Input
                        value={loc.about_hero_headline}
                        onChange={(e) => updateLocation(loc.id, "about_hero_headline", e.target.value)}
                        placeholder="Store-specific headline"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Subtext</Label>
                      <Textarea
                        value={loc.about_hero_subtext}
                        onChange={(e) => updateLocation(loc.id, "about_hero_subtext", e.target.value)}
                        rows={3}
                        placeholder="Brief intro paragraph…"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Story Content (HTML supported)</Label>
                      <Textarea
                        value={loc.about_story}
                        onChange={(e) => updateLocation(loc.id, "about_story", e.target.value)}
                        rows={12}
                        placeholder="Write this store's unique story here…"
                        className="font-mono text-xs"
                      />
                    </div>
                    {/* Location image upload */}
                    <div>
                      <Label className="text-xs">Location Photo</Label>
                      <p className="text-[10px] text-muted-foreground mb-2">Building exterior, team photo, or storefront image.</p>
                      <div className="border border-border rounded-lg p-3 bg-muted/30 flex flex-col items-center gap-2 min-h-[80px]">
                        {loc.about_image_url ? (
                          <div className="relative">
                            <img src={loc.about_image_url} alt="Location" className="max-h-24 rounded-md object-cover" />
                            <button
                              type="button"
                              onClick={() => updateLocation(loc.id, "about_image_url", "")}
                              className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            >×</button>
                          </div>
                        ) : (
                          <ImagePlus className="w-8 h-8 text-muted-foreground/40" />
                        )}
                        <label className="cursor-pointer text-xs text-primary hover:underline">
                          {loc.about_image_url ? "Replace" : "Upload"}
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f, (url) => updateLocation(loc.id, "about_image_url", url));
                            e.target.value = "";
                          }} />
                        </label>
                      </div>
                      <Input
                        value={loc.about_image_url}
                        onChange={(e) => updateLocation(loc.id, "about_image_url", e.target.value)}
                        placeholder="Or paste URL"
                        className="text-xs h-8 mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
          <CorporateAboutFields
            heroHeadline={heroHeadline} setHeroHeadline={setHeroHeadline}
            heroSubtext={heroSubtext} setHeroSubtext={setHeroSubtext}
            story={story} setStory={setStory}
            imageUrls={aboutImageUrls} setImageUrls={setAboutImageUrls}
            onImageUpload={(file) => handleImageUpload(file, (url) => setAboutImageUrls(prev => [...prev, url]))}
            milestones={milestones} setMilestones={setMilestones}
            values={values} setValues={setValues}
            heroOpen={heroOpen} setHeroOpen={setHeroOpen}
            storyOpen={storyOpen} setStoryOpen={setStoryOpen}
            milestonesOpen={milestonesOpen} setMilestonesOpen={setMilestonesOpen}
            valuesOpen={valuesOpen} setValuesOpen={setValuesOpen}
            addMilestone={addMilestone} removeMilestone={removeMilestone} updateMilestone={updateMilestone}
            addValue={addValue} removeValue={removeValue} updateValue={updateValue}
          />
        </>
      )}
    </div>
  );
};

/* ─── Corporate About Fields (shared) ─── */
interface CorporateAboutFieldsProps {
  heroHeadline: string; setHeroHeadline: (v: string) => void;
  heroSubtext: string; setHeroSubtext: (v: string) => void;
  story: string; setStory: (v: string) => void;
  imageUrls: string[]; setImageUrls: (v: string[]) => void;
  onImageUpload: (file: File) => void;
  milestones: Milestone[]; setMilestones: (v: Milestone[]) => void;
  values: ValueItem[]; setValues: (v: ValueItem[]) => void;
  heroOpen: boolean; setHeroOpen: (v: boolean) => void;
  storyOpen: boolean; setStoryOpen: (v: boolean) => void;
  milestonesOpen: boolean; setMilestonesOpen: (v: boolean) => void;
  valuesOpen: boolean; setValuesOpen: (v: boolean) => void;
  addMilestone: () => void; removeMilestone: (i: number) => void; updateMilestone: (i: number, f: keyof Milestone, v: string) => void;
  addValue: () => void; removeValue: (i: number) => void; updateValue: (i: number, f: keyof ValueItem, v: string) => void;
}

const CorporateAboutFields = ({
  heroHeadline, setHeroHeadline, heroSubtext, setHeroSubtext,
  story, setStory,
  imageUrls, setImageUrls, onImageUpload,
  milestones, values,
  heroOpen, setHeroOpen, storyOpen, setStoryOpen,
  milestonesOpen, setMilestonesOpen, valuesOpen, setValuesOpen,
  addMilestone, removeMilestone, updateMilestone,
  addValue, removeValue, updateValue,
}: CorporateAboutFieldsProps) => (
  <div className="space-y-4">
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
            Leave blank to use the default story. Supports basic HTML tags for formatting.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>

    {/* About Photo */}
    <div className="px-1">
      <Label className="text-xs font-semibold">Dealership Photo</Label>
      <p className="text-[10px] text-muted-foreground mb-2">Upload a building exterior, family photo, or team image for the About page.</p>
      <div className="border border-border rounded-lg p-3 bg-muted/30 flex flex-col items-center gap-2 min-h-[100px]">
        {imageUrl ? (
          <div className="relative">
            <img src={imageUrl} alt="About" className="max-h-32 rounded-md object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
            >×</button>
          </div>
        ) : (
          <ImagePlus className="w-10 h-10 text-muted-foreground/40" />
        )}
        <label className="cursor-pointer text-xs text-primary hover:underline">
          {imageUrl ? "Replace image" : "Upload image"}
          <input type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) onImageUpload(f);
            e.target.value = "";
          }} />
        </label>
      </div>
      <Input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="Or paste image URL"
        className="text-xs h-8 mt-1"
      />
    </div>

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

export default AboutPageConfig;

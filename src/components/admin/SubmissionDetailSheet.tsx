import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QRCodeSVG } from "qrcode.react";
import VehicleImage from "@/components/sell-form/VehicleImage";
import StaffFileUpload from "@/components/admin/StaffFileUpload";
import FollowUpPanel from "@/components/admin/FollowUpPanel";
import RetailMarketPanel from "@/components/admin/RetailMarketPanel";
import {
  X, Printer, Users, Car, Search, DollarSign, Info, FileText, Gauge, Palette,
  Settings2, Wrench, Key, Wind, Cigarette, CircleDot, Sparkles, TrendingUp,
  AlertTriangle, Bell, Mail, Phone, StickyNote, CalendarDays, Camera,
  ExternalLink, Upload, Check, XCircle, MapPin, Star, History, Clock,
  ClipboardCheck, ClipboardList, Save, Trash2, CheckCircle2,
} from "lucide-react";
import type { Submission, DealerLocation } from "@/lib/adminConstants";
import {
  getProgressStages, getStageIndex, getStatusLabel,
  ALL_STATUS_OPTIONS, DOC_TYPE_LABELS,
} from "@/lib/adminConstants";
import { printSubmissionDetail, printAllDocs, printCheckRequest } from "@/lib/printUtils";
import { useToast } from "@/hooks/use-toast";
import harteLogoFallback from "@/assets/harte-logo.png";

interface SubmissionDetailSheetProps {
  selected: Submission | null;
  onClose: () => void;
  photos: { url: string; name: string }[];
  docs: { name: string; url: string; type: string }[];
  activityLog: { id: string; action: string; old_value: string | null; new_value: string | null; performed_by: string | null; created_at: string }[];
  duplicateWarnings: Record<string, string[]>;
  optOutStatus: { email: boolean; sms: boolean };
  selectedApptTime: string | null;
  selectedApptLocation: string | null;
  dealerLocations: DealerLocation[];
  canSetPrice: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canUpdateStatus: boolean;
  auditLabel: string;
  userName: string;
  onUpdate: (updated: Submission) => void;
  onDelete: (id: string) => void;
  onRefresh: (sub: Submission) => void;
  onScheduleAppointment: (sub: Submission) => void;
  onDeletePhoto: (fileName: string) => void;
  onDeleteDoc: (docType: string, fileName: string) => void;
  fetchActivityLog: (id: string) => void;
  fetchSubmissions: () => void;
}

// ── Section Card wrapper with gradient header ──
const SectionCard = ({
  icon: Icon,
  title,
  children,
  headerRight,
  className = "",
}: {
  icon?: React.ElementType;
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}) => (
  <div data-print-section className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2.5 border-b border-border flex items-center justify-between">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
        {title}
      </h3>
      {headerRight}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const DetailRow = ({ label, value, icon }: { label: string; value: React.ReactNode | string | null | undefined; icon?: React.ReactNode }) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-medium text-card-foreground text-right max-w-[60%]">{value}</span>
    </div>
  );
};

const ArrayDetail = ({ label, value, icon }: { label: string; value: string[] | null | undefined; icon?: React.ReactNode }) => {
  if (!value || value.length === 0 || (value.length === 1 && value[0] === "none")) return null;
  return <DetailRow label={label} value={value.join(", ")} icon={icon} />;
};

const SubmissionDetailSheet = ({
  selected,
  onClose,
  photos,
  docs,
  activityLog,
  duplicateWarnings,
  optOutStatus,
  selectedApptTime,
  selectedApptLocation,
  dealerLocations,
  canSetPrice,
  canApprove,
  canDelete,
  canUpdateStatus,
  auditLabel,
  userName,
  onUpdate,
  onDelete,
  onRefresh,
  onScheduleAppointment,
  onDeletePhoto,
  onDeleteDoc,
  fetchActivityLog,
  fetchSubmissions,
}: SubmissionDetailSheetProps) => {
  const { toast } = useToast();
  const [editState, setEditState] = useState<Submission | null>(null);

  // Sync editState with selected
  const sub = editState?.id === selected?.id ? editState : selected;

  const updateField = (updates: Partial<Submission>) => {
    if (!sub) return;
    setEditState({ ...sub, ...updates });
  };

  const getDocsUrl = (token: string) => `${window.location.origin}/docs/${token}`;

  const getLocationLabel = (loc: string | null) => {
    if (!loc) return null;
    const found = dealerLocations.find(l => l.id === loc || l.name.toLowerCase().replace(/\s+/g, "_") === loc);
    if (found) return `${found.name} — ${found.city}, ${found.state}`;
    return loc;
  };

  const handlePrint = () => {
    if (!sub) return;
    const stages = getProgressStages(sub);
    printSubmissionDetail(sub, photos, docs, stages, getStageIndex, getDocsUrl(sub.token), DOC_TYPE_LABELS);
  };

  const handlePrintAllDocs = async () => {
    if (!sub) return;
    const vehicleStr = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "N/A";
    const fetchDocImages = async (folder: string): Promise<string[]> => {
      const urls: string[] = [];
      const { data: files } = await supabase.storage.from("customer-documents").list(`${sub.token}/${folder}`);
      if (files && files.length > 0) {
        for (const f of files) {
          const { data } = await supabase.storage.from("customer-documents").createSignedUrl(`${sub.token}/${folder}/${f.name}`, 3600);
          if (data?.signedUrl) urls.push(data.signedUrl);
        }
      }
      return urls;
    };
    const [dl, dlF, dlB, reg, title, appr, carfax, payoff, ws] = await Promise.all([
      fetchDocImages("drivers_license"), fetchDocImages("drivers_license_front"), fetchDocImages("drivers_license_back"),
      fetchDocImages("registration"), fetchDocImages("title"), fetchDocImages("appraisal"),
      fetchDocImages("carfax"), fetchDocImages("payoff_verification"), fetchDocImages("window_sticker"),
    ]);
    const result = printAllDocs(sub.name, vehicleStr, [
      { title: "Driver's License", images: [...dl, ...dlF, ...dlB] },
      { title: "Registration", images: reg },
      { title: "Title", images: title },
      { title: "Appraisal", images: appr },
      { title: "Carfax", images: carfax },
      { title: "Payoff Documentation", images: payoff },
      { title: "Window Sticker", images: ws },
    ]);
    if (!result) toast({ title: "No Documents", description: "No documents have been uploaded.", variant: "destructive" });
  };

  const handleGenerateCheckRequest = async () => {
    if (!sub || !sub.offered_price) return;
    const hasAddress = sub.address_street && (sub.address_city || sub.address_state || sub.zip);
    if (!hasAddress) {
      toast({ title: "Missing Address", description: "Customer street address must be entered.", variant: "destructive" });
      return;
    }
    const { data: appraisalCheck } = await supabase.storage.from("customer-documents").list(`${sub.token}/appraisal`);
    if (!appraisalCheck || appraisalCheck.length === 0) {
      toast({ title: "Missing Appraisal", description: "An ACV appraisal document must be uploaded.", variant: "destructive" });
      return;
    }
    const [dlLegacy, dlFront] = await Promise.all([
      supabase.storage.from("customer-documents").list(`${sub.token}/drivers_license`),
      supabase.storage.from("customer-documents").list(`${sub.token}/drivers_license_front`),
    ]);
    const hasDL = (dlLegacy.data && dlLegacy.data.length > 0) || (dlFront.data && dlFront.data.length > 0);
    if (!hasDL) {
      toast({ title: "Missing Driver's License", description: "Customer driver's license must be uploaded.", variant: "destructive" });
      return;
    }
    let logoBase64 = "";
    try {
      const resp = await fetch(harteLogoFallback);
      const blob = await resp.blob();
      logoBase64 = await new Promise<string>((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(blob); });
    } catch { logoBase64 = ""; }
    const fetchDocImages = async (folder: string): Promise<string[]> => {
      const urls: string[] = [];
      const { data: files } = await supabase.storage.from("customer-documents").list(`${sub.token}/${folder}`);
      if (files && files.length > 0) {
        for (const f of files) { const { data } = await supabase.storage.from("customer-documents").createSignedUrl(`${sub.token}/${folder}/${f.name}`, 3600); if (data?.signedUrl) urls.push(data.signedUrl); }
      }
      return urls;
    };
    const [apprImg, dlImg, dlFImg, dlBImg, titleImg, payoffImg] = await Promise.all([
      fetchDocImages("appraisal"), fetchDocImages("drivers_license"), fetchDocImages("drivers_license_front"),
      fetchDocImages("drivers_license_back"), fetchDocImages("title"), fetchDocImages("payoff_verification"),
    ]);
    const inspectionTextSections: { title: string; text: string }[] = [];
    if (sub.internal_notes && sub.internal_notes.includes("[INSPECTION")) {
      inspectionTextSections.push({ title: "Inspection Report", text: sub.internal_notes });
    }
    const html = printCheckRequest(sub, logoBase64, [
      { title: "Appraisal Document", images: apprImg },
      { title: "Driver's License", images: [...dlImg, ...dlFImg, ...dlBImg] },
      { title: "Title", images: titleImg },
      { title: "Payoff Documentation", images: payoffImg },
    ], inspectionTextSections);
    if (html) {
      try {
        const blob = new Blob([html], { type: "text/html" });
        const fileName = `check-request-${new Date().toISOString().slice(0, 10)}.html`;
        await supabase.storage.from("customer-documents").upload(`${sub.token}/check_request/${fileName}`, blob, { contentType: "text/html", upsert: true });
        toast({ title: "Check Request Generated", description: "Printed and saved to documents." });
      } catch {
        toast({ title: "Check request printed", description: "But failed to save a copy.", variant: "destructive" });
      }
    }
  };

  const handleSave = async () => {
    if (!sub) return;
    const { error } = await supabase.from("submissions").update({
      progress_status: sub.progress_status,
      offered_price: sub.offered_price,
      acv_value: sub.acv_value,
      check_request_done: sub.check_request_done,
      internal_notes: sub.internal_notes,
      name: sub.name,
      phone: sub.phone,
      email: sub.email,
      zip: sub.zip,
      address_street: sub.address_street,
      address_city: sub.address_city,
      address_state: sub.address_state,
      store_location_id: sub.store_location_id || null,
      status_updated_at: new Date().toISOString(),
    }).eq("id", sub.id);

    if (!error) {
      // Log changes
      if (selected && selected.progress_status !== sub.progress_status) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "Status Changed",
          old_value: getStatusLabel(selected.progress_status),
          new_value: getStatusLabel(sub.progress_status),
          performed_by: auditLabel,
        });
      }
      if (selected && selected.offered_price !== sub.offered_price) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "Price Updated",
          old_value: selected.offered_price ? `$${selected.offered_price.toLocaleString()}` : "None",
          new_value: sub.offered_price ? `$${sub.offered_price.toLocaleString()}` : "None",
          performed_by: auditLabel,
        });
      }
      if (selected && selected.acv_value !== sub.acv_value) {
        await supabase.from("activity_log").insert({
          submission_id: sub.id, action: "ACV Updated",
          old_value: selected.acv_value ? `$${selected.acv_value.toLocaleString()}` : "None",
          new_value: sub.acv_value ? `$${sub.acv_value.toLocaleString()}` : "None",
          performed_by: auditLabel,
        });
      }
      // Notifications
      if (selected) {
        if (!selected.offered_price && sub.offered_price) {
          supabase.functions.invoke("send-notification", { body: { trigger_key: "customer_offer_ready", submission_id: sub.id } }).catch(console.error);
        }
        if (selected.offered_price && sub.offered_price && sub.offered_price > selected.offered_price) {
          supabase.functions.invoke("send-notification", { body: { trigger_key: "customer_offer_increased", submission_id: sub.id } }).catch(console.error);
        }
        if (selected.progress_status !== "purchase_complete" && sub.progress_status === "purchase_complete") {
          supabase.functions.invoke("send-notification", { body: { trigger_key: "staff_deal_completed", submission_id: sub.id } }).catch(console.error);
        }
        if (selected.progress_status !== sub.progress_status) {
          supabase.functions.invoke("send-notification", { body: { trigger_key: "status_change", submission_id: sub.id } }).catch(console.error);
        }
      }
      const { data: refreshed } = await supabase.from("submissions").select("*").eq("id", sub.id).maybeSingle();
      if (refreshed) {
        setEditState(refreshed as any);
        onUpdate(refreshed as any);
      }
      fetchActivityLog(sub.id);
      toast({ title: "Record updated", description: "All changes have been saved." });
    } else {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  };

  if (!sub) return null;

  const currentStageIdx = getStageIndex(sub.progress_status);
  const stages = getProgressStages(sub);
  const isPriceAgreedOrBeyond = sub.progress_status !== "dead_lead" && currentStageIdx >= getStageIndex("deal_finalized") && sub.offered_price;
  const isAutoPopulated = sub.offered_price != null && sub.estimated_offer_high != null && sub.offered_price === sub.estimated_offer_high;

  return (
    <Sheet open={!!selected} onOpenChange={() => { setEditState(null); onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl p-0 flex flex-col overflow-hidden [&>button]:hidden">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-4">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold text-primary-foreground font-display tracking-wide">
                {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model || "Submission Details"}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => window.open(`${window.location.origin}/appraisal/${sub.token}`, "_blank")} className="text-primary-foreground hover:bg-primary-foreground/20 print:hidden">
                  <Gauge className="w-4 h-4 mr-1" /> Appraisal
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.open(`${window.location.origin}/inspection/${sub.id}`, "_blank")} className="text-primary-foreground hover:bg-primary-foreground/20 print:hidden">
                  <ClipboardList className="w-4 h-4 mr-1" /> Inspection
                </Button>
                <Button variant="ghost" size="sm" onClick={handlePrint} className="text-primary-foreground hover:bg-primary-foreground/20 print:hidden">
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setEditState(null); onClose(); }} className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-primary-foreground/80 text-sm">
                Submitted {new Date(sub.created_at).toLocaleDateString()} • {sub.name || "Unknown"}
              </p>
              <Badge className={`text-[10px] ${
                sub.progress_status === "purchase_complete" ? "bg-success/20 text-success border-success/30" :
                sub.progress_status === "dead_lead" ? "bg-destructive/20 text-destructive-foreground border-destructive/30" :
                "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
              }`}>
                {getStatusLabel(sub.progress_status)}
              </Badge>
            </div>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Alerts */}
            {duplicateWarnings[sub.id]?.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-destructive">Possible Duplicate</p>
                  {duplicateWarnings[sub.id].map((w, i) => <p key={i} className="text-xs text-destructive/80">{w}</p>)}
                </div>
              </div>
            )}
            {(optOutStatus.email || optOutStatus.sms) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Customer Unsubscribed</p>
                  <div className="flex gap-2 mt-1">
                    {optOutStatus.email && <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-300"><Mail className="w-3 h-3 mr-1" /> Email opted out</Badge>}
                    {optOutStatus.sms && <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-300"><Phone className="w-3 h-3 mr-1" /> SMS opted out</Badge>}
                  </div>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Follow-up messages to opted-out channels will be skipped automatically.</p>
                </div>
              </div>
            )}

            {/* Contact + Vehicle */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SectionCard icon={Users} title="Contact Information">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={sub.name || ""} onChange={(e) => updateField({ name: e.target.value || null })} placeholder="Full name" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input value={sub.phone || ""} onChange={(e) => updateField({ phone: e.target.value || null })} placeholder="(555) 123-4567" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input type="email" value={sub.email || ""} onChange={(e) => updateField({ email: e.target.value || null })} placeholder="email@example.com" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ZIP</Label>
                    <Input value={sub.zip || ""} onChange={(e) => updateField({ zip: e.target.value || null })} placeholder="ZIP code" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <Label className="text-xs text-muted-foreground font-semibold block mb-2">Address</Label>
                  <div className="space-y-2">
                    <Input value={sub.address_street || ""} onChange={(e) => updateField({ address_street: e.target.value || null })} placeholder="Street address" className="h-8 text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={sub.address_city || ""} onChange={(e) => updateField({ address_city: e.target.value || null })} placeholder="City" className="h-8 text-sm" />
                      <Input value={sub.address_state || ""} onChange={(e) => updateField({ address_state: e.target.value || null })} placeholder="State" className="h-8 text-sm" />
                      <Input value={sub.zip || ""} placeholder="ZIP" className="h-8 text-sm" disabled />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={Car}
                title="Vehicle Details"
                headerRight={(() => {
                  const INSPECTED_STATUSES = ['inspection_completed','appraisal_completed','manager_approval','price_agreed','title_verified','ownership_verified','purchase_complete'];
                  const isInspected = INSPECTED_STATUSES.includes(sub.progress_status);
                  const inspClass = isInspected
                    ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 border-0"
                    : "bg-gradient-to-r from-orange-400 to-amber-500 text-white hover:from-orange-500 hover:to-amber-600 border-0";
                  const inspLabel = isInspected ? "Inspection Completed" : "Inspection Needed";
                  return (
                    <Button size="sm" className={`h-7 text-xs gap-1 ${inspClass}`} onClick={() => window.open(`${window.location.origin}/inspection/${sub.id}`, "_blank")}>
                      <ClipboardList className="w-3.5 h-3.5" /> {inspLabel}
                    </Button>
                  );
                })()}
              >
                {sub.vehicle_year && sub.vehicle_make && sub.vehicle_model && (
                  <div className="mb-4 rounded-lg overflow-hidden bg-gradient-to-b from-muted/30 to-transparent" style={{ aspectRatio: "16/7" }}>
                    <VehicleImage year={sub.vehicle_year} make={sub.vehicle_make} model={sub.vehicle_model} selectedColor={sub.exterior_color || ""} compact />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Year/Make/Model" value={`${sub.vehicle_year || ""} ${sub.vehicle_make || ""} ${sub.vehicle_model || ""}`.trim() || null} icon={<Car className="w-3.5 h-3.5" />} />
                  <DetailRow label="VIN" value={
                    sub.vin ? (
                      <span className="flex items-center gap-1.5">
                        {sub.vin}
                        {(sub as any).vin_verified && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 rounded-full px-1.5 py-0.5" title="VIN verified via document OCR">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </span>
                    ) : null
                  } icon={<Info className="w-3.5 h-3.5" />} />
                  <DetailRow label="Plate" value={sub.plate} icon={<FileText className="w-3.5 h-3.5" />} />
                  <DetailRow label="Mileage" value={sub.mileage} icon={<Gauge className="w-3.5 h-3.5" />} />
                  <DetailRow label="Exterior Color" value={sub.exterior_color} icon={<Palette className="w-3.5 h-3.5" />} />
                  <DetailRow label="Drivetrain" value={sub.drivetrain} icon={<Settings2 className="w-3.5 h-3.5" />} />
                  <DetailRow label="Modifications" value={sub.modifications} icon={<Settings2 className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>
            </div>

            {/* Condition + Loan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SectionCard icon={Search} title="Condition & History">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Overall" value={sub.overall_condition} icon={<Sparkles className="w-3.5 h-3.5" />} />
                  <DetailRow label="Drivable" value={sub.drivable} icon={<Car className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Exterior Damage" value={sub.exterior_damage} icon={<Palette className="w-3.5 h-3.5" />} />
                  <DetailRow label="Windshield" value={sub.windshield_damage} icon={<Wind className="w-3.5 h-3.5" />} />
                  <DetailRow label="Moonroof" value={sub.moonroof} />
                  <ArrayDetail label="Interior Damage" value={sub.interior_damage} icon={<CircleDot className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Tech Issues" value={sub.tech_issues} icon={<Search className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Engine Issues" value={sub.engine_issues} icon={<Settings2 className="w-3.5 h-3.5" />} />
                  <ArrayDetail label="Mechanical Issues" value={sub.mechanical_issues} icon={<Wrench className="w-3.5 h-3.5" />} />
                  <DetailRow label="Accidents" value={sub.accidents} icon={<Car className="w-3.5 h-3.5" />} />
                  <DetailRow label="Smoked In" value={sub.smoked_in} icon={<Cigarette className="w-3.5 h-3.5" />} />
                  <DetailRow label="Tires Replaced" value={sub.tires_replaced} icon={<CircleDot className="w-3.5 h-3.5" />} />
                  <DetailRow label="Keys" value={sub.num_keys} icon={<Key className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              <SectionCard icon={DollarSign} title="Loan & Info">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <DetailRow label="Loan Status" value={sub.loan_status} icon={<Info className="w-3.5 h-3.5" />} />
                  <DetailRow label="Loan Company" value={sub.loan_company} icon={<FileText className="w-3.5 h-3.5" />} />
                  <DetailRow label="Loan Balance" value={sub.loan_balance} icon={<DollarSign className="w-3.5 h-3.5" />} />
                  <DetailRow label="Loan Payment" value={sub.loan_payment} icon={<DollarSign className="w-3.5 h-3.5" />} />
                  <DetailRow label="Next Step" value={sub.next_step} icon={<TrendingUp className="w-3.5 h-3.5" />} />
                  <div className="flex items-center justify-between col-span-2 mt-1">
                    <span className="text-xs text-muted-foreground">Lead Source</span>
                    <Select value={sub.lead_source} onValueChange={async (val) => {
                      await supabase.from("submissions").update({ lead_source: val }).eq("id", sub.id);
                      updateField({ lead_source: val });
                      toast({ title: "Lead source updated" });
                    }}>
                      <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inventory">Off Street Purchase</SelectItem>
                        <SelectItem value="service">Service Drive</SelectItem>
                        <SelectItem value="trade">Trade-In</SelectItem>
                        <SelectItem value="in_store_trade">In-Store Trade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Acquisition Tracker */}
            <SectionCard icon={TrendingUp} title="Acquisition Tracker" headerRight={
              sub.progress_status !== "new" && sub.progress_status !== "dead_lead" ? (
                <span className="text-[10px] text-muted-foreground italic">Customer view synced</span>
              ) : undefined
            }>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sub.appointment_set ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  <CalendarDays className="w-3 h-3" /> Inspection {sub.appointment_set ? "Scheduled" : "Not Set"}
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sub.docs_uploaded ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  <FileText className="w-3 h-3" /> Docs {sub.docs_uploaded ? "Uploaded" : "Pending"}
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sub.photos_uploaded ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  <Camera className="w-3 h-3" /> Photos {sub.photos_uploaded ? "Uploaded" : "Pending"}
                </div>
              </div>

              {sub.progress_status === "dead_lead" ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/15">
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span className="font-bold text-destructive text-sm">Dead Lead</span>
                </div>
              ) : (
                <div className="flex items-center gap-0 w-full">
                  {stages.filter(s => s.key !== "dead_lead").map((stage, i, arr) => {
                    const isComplete = i < currentStageIdx;
                    const isCurrent = i === currentStageIdx;
                    return (
                      <div key={stage.key} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center w-full">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                            isComplete ? "bg-success text-success-foreground shadow-sm" :
                            isCurrent ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {isComplete ? <Check className="w-3.5 h-3.5" /> : <stage.icon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`text-[10px] mt-1.5 text-center leading-tight max-w-[70px] ${
                            isCurrent ? "font-bold text-card-foreground" :
                            isComplete ? "font-medium text-card-foreground" :
                            "text-muted-foreground"
                          }`}>
                            {stage.label}
                          </span>
                        </div>
                        {i < arr.length - 1 && <div className={`h-[2px] flex-1 min-w-[8px] -mt-4 ${isComplete ? "bg-success" : "bg-border"}`} />}
                      </div>
                    );
                  })}
                </div>
              )}

              {(sub.progress_status === "inspection_completed" || sub.progress_status === "manager_approval_inspection") && (
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(getDocsUrl(sub.token), "_blank")}>
                    <Upload className="w-3 h-3 mr-1" /> Upload Appraisal
                  </Button>
                </div>
              )}

              <div className="mt-4">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Update Status</label>
                <Select
                  value={sub.progress_status}
                  disabled={!canUpdateStatus || (["deal_finalized", "check_request_submitted", "purchase_complete"].includes(sub.progress_status) && !canApprove)}
                  onValueChange={(val) => {
                    if (["deal_finalized", "check_request_submitted", "purchase_complete"].includes(val) && !canApprove) {
                      toast({ title: "Not authorized", description: "Only GSM/GM can approve.", variant: "destructive" });
                      return;
                    }
                    updateField({ progress_status: val });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_STATUS_OPTIONS.map(s => {
                      const locked = ["deal_finalized", "check_request_submitted", "purchase_complete"].includes(s.key) && !canApprove;
                      return <SelectItem key={s.key} value={s.key} disabled={locked}>{s.label}{locked ? " (GSM/GM only)" : ""}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              {sub.progress_status === "inspection_completed" && canSetPrice && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">In-House ACV <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="number" placeholder="Enter ACV amount" className="pl-7" value={sub.acv_value?.toString() || ""} onChange={(e) => updateField({ acv_value: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  {!sub.acv_value && <p className="text-xs text-destructive">ACV value is required before updating.</p>}
                  {sub.appraised_by && sub.acv_value && <p className="text-xs text-muted-foreground">Appraised by: {sub.appraised_by}</p>}
                </div>
              )}
              {sub.progress_status === "inspection_completed" && !canSetPrice && sub.acv_value && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">In-House ACV</label>
                  <p className="text-card-foreground font-medium">${Number(sub.acv_value).toLocaleString()}</p>
                  {sub.appraised_by && <p className="text-xs text-muted-foreground">Appraised by: {sub.appraised_by}</p>}
                </div>
              )}
            </SectionCard>

            {/* Offered Price */}
            {(canSetPrice || sub.offered_price) && (
              <SectionCard icon={DollarSign} title="Offered Price" headerRight={
                sub.offered_price != null ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-help ${isAutoPopulated ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                          {isAutoPopulated ? "Auto · Customer Accepted" : "Staff Set"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        {isAutoPopulated ? "Automatically set when the customer accepted." : "Manually entered by a manager or admin."}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }>
                {canSetPrice ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-7"
                      value={sub.offered_price != null ? Number(sub.offered_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        updateField({ offered_price: raw ? Number(raw) : null });
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-card-foreground font-medium">
                    {(() => {
                      const val = sub.offered_price ?? 0;
                      const [dollars, cents] = val.toFixed(2).split(".");
                      return <>${Number(dollars).toLocaleString()}.<span className="text-[0.7em] align-baseline">{cents}</span></>;
                    })()}
                  </p>
                )}
              </SectionCard>
            )}

            {/* Retail Market Context */}
            {(sub.vin || sub.vehicle_year) && (
              <SectionCard icon={TrendingUp} title="Retail Market">
                <RetailMarketPanel
                  vin={sub.vin || undefined}
                  zipcode={sub.zip || undefined}
                  offerHigh={sub.offered_price ?? sub.estimated_offer_high ?? 0}
                />
              </SectionCard>
            )}

            <SectionCard icon={ClipboardCheck} title="Check Request">
              <div className="flex items-center gap-3 mb-3">
                <Checkbox id="check-request-done" checked={sub.check_request_done} disabled={!isPriceAgreedOrBeyond} onCheckedChange={(checked) => updateField({ check_request_done: !!checked })} />
                <label htmlFor="check-request-done" className={`text-sm font-medium ${isPriceAgreedOrBeyond ? "text-card-foreground" : "text-muted-foreground"}`}>Check Request Done</label>
              </div>
              {isPriceAgreedOrBeyond ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleGenerateCheckRequest}><Printer className="w-4 h-4 mr-1" /> Generate Check Request</Button>
                    <Button variant="outline" size="sm" onClick={handlePrintAllDocs}><FileText className="w-4 h-4 mr-1" /> Print All Docs</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Check request includes all docs. "Print All Docs" reprints supporting documents only.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Available once price is agreed and entered.</p>
              )}
            </SectionCard>

            {/* Review Request */}
            {sub.progress_status === "purchase_complete" && sub.email && (
              <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                <div className="bg-gradient-to-r from-success/10 to-success/5 -mx-4 -mt-4 px-4 py-2.5 border-b border-success/20 mb-4 rounded-t-xl">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-success" /> Request Customer Review
                  </h3>
                </div>
                {sub.review_requested ? (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">Review request sent{sub.review_requested_at ? ` on ${new Date(sub.review_requested_at).toLocaleDateString()}` : ""}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Send an email asking the customer to leave a review.</p>
                    <Button variant="outline" size="sm" className="border-success/40 text-success hover:bg-success/10" onClick={async () => {
                      toast({ title: "Sending...", description: "Sending review request email..." });
                      try {
                        const res = await supabase.functions.invoke("send-review-request", { body: { submission_id: sub.id, submission_token: sub.token } });
                        if (res.error || res.data?.error) { toast({ title: "Failed", description: res.data?.error || "Could not send.", variant: "destructive" }); }
                        else {
                          toast({ title: "Sent! ⭐", description: "Review request sent." });
                          updateField({ review_requested: true, review_requested_at: new Date().toISOString() });
                          fetchSubmissions();
                        }
                      } catch { toast({ title: "Error", description: "Something went wrong.", variant: "destructive" }); }
                    }}>
                      <Mail className="w-4 h-4 mr-1" /> Send Review Request
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Assigned Store */}
            <SectionCard icon={MapPin} title="Assigned Store">
              <Select value={sub.store_location_id || "unassigned"} onValueChange={(v) => updateField({ store_location_id: v === "unassigned" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">— Not Assigned —</SelectItem>
                  {dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>)}
                </SelectContent>
              </Select>
            </SectionCard>

            {/* Internal Notes */}
            <SectionCard icon={StickyNote} title="Internal Notes">
              <Textarea placeholder="Add team notes here..." value={sub.internal_notes || ""} onChange={(e) => updateField({ internal_notes: e.target.value || null })} rows={3} />
            </SectionCard>

            {/* Photos + Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SectionCard icon={Camera} title={`Photos ${photos.length > 0 ? `(${photos.length})` : ""}`}>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative group">
                        <a href={photo.url} target="_blank" rel="noopener noreferrer">
                          <img src={photo.url} alt={`Photo ${i + 1}`} className="rounded-lg w-full h-28 object-cover hover:opacity-80 transition-opacity" />
                        </a>
                        {canDelete && (
                          <button onClick={() => onDeletePhoto(photo.name)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete photo">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No photos uploaded.</p>}
                <StaffFileUpload token={sub.token} bucket="submission-photos" onUploadComplete={() => onRefresh(sub)} />
              </SectionCard>

              <SectionCard icon={FileText} title={`Documents ${docs.length > 0 ? `(${docs.length})` : ""}`}>
                {docs.length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(docs.reduce<Record<string, typeof docs>>((acc, doc) => { if (!acc[doc.type]) acc[doc.type] = []; acc[doc.type].push(doc); return acc; }, {})).map(([type, typeDocs]) => (
                      <div key={type}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">{DOC_TYPE_LABELS[type] || type}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {typeDocs.map((doc, i) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
                            return (
                              <div key={i} className="relative group">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
                                  {isImage ? <img src={doc.url} alt={doc.name} className="rounded-lg w-full h-28 object-cover hover:opacity-80 transition-opacity" /> : (
                                    <div className="rounded-lg w-full h-28 bg-muted flex flex-col items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                                      <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                                      <span className="text-[10px] text-muted-foreground text-center px-1 truncate w-full">{doc.name}</span>
                                    </div>
                                  )}
                                </a>
                                {canDelete && (
                                  <button onClick={() => onDeleteDoc(doc.type, doc.name)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete document">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
                <StaffFileUpload token={sub.token} bucket="customer-documents" onUploadComplete={() => onRefresh(sub)} />
              </SectionCard>
            </div>

            {/* Appointment */}
            <SectionCard icon={CalendarDays} title="Appointment">
              {sub.appointment_set && sub.appointment_date ? (
                <div className="space-y-2">
                  <p className="text-sm text-card-foreground font-medium">
                    {new Date(sub.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    {selectedApptTime && <span className="ml-1">at {selectedApptTime}</span>}
                  </p>
                  {selectedApptLocation && <p className="text-sm text-muted-foreground">📍 {getLocationLabel(selectedApptLocation)}</p>}
                  <Button variant="outline" size="sm" onClick={() => onScheduleAppointment(sub)}>
                    <CalendarDays className="w-4 h-4 mr-1" /> Reschedule Appointment
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => onScheduleAppointment(sub)}>
                  <CalendarDays className="w-4 h-4 mr-1" /> Schedule Appointment
                </Button>
              )}
            </SectionCard>

            {/* Customer Documents QR */}
            <SectionCard icon={FileText} title="Customer Documents">
              <p className="text-sm text-muted-foreground mb-3">Send this link to upload Driver's License, Registration, Title Inquiry, or Title.</p>
              <div className="flex items-start gap-4">
                <div className="bg-white p-2 rounded-lg flex-shrink-0">
                  <QRCodeSVG value={getDocsUrl(sub.token)} size={100} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="bg-background rounded-md p-2 border border-border">
                    <p className="text-xs text-muted-foreground break-all font-mono">{getDocsUrl(sub.token)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(getDocsUrl(sub.token)); toast({ title: "Link copied!" }); }}>Copy Link</Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(getDocsUrl(sub.token), "_blank")}><ExternalLink className="w-3 h-3 mr-1" /> Open</Button>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Follow-Up Sequence */}
            <FollowUpPanel submissionId={sub.id} hasOffer={!!(sub.offered_price || sub.estimated_offer_high)} progressStatus={sub.progress_status} />

            {/* Activity Log */}
            <SectionCard icon={History} title="Activity Log">
              {activityLog.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activityLog.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs border-b border-border pb-2 last:border-0">
                      <Clock className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-card-foreground">{log.action}</span>
                        {log.old_value && log.new_value && <span className="text-muted-foreground"> — {log.old_value} → {log.new_value}</span>}
                        <div className="text-muted-foreground mt-0.5">
                          {log.performed_by && <span className="capitalize">{log.performed_by.replace(/_/g, " ")}</span>}
                          {" · "}
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
            </SectionCard>

            {/* Sticky Save Bar */}
            <div className="sticky bottom-0 bg-card pt-3 pb-1 border-t border-border flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] rounded-t-lg px-4 -mx-4">
              <Button className="flex-1" disabled={sub.progress_status === "inspection_completed" && !sub.acv_value} onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" /> Update Record
              </Button>
              {canDelete && (
                <Button variant="destructive" onClick={() => onDelete(sub.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default SubmissionDetailSheet;

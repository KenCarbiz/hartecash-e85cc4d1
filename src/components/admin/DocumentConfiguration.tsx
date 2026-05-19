import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText, GripVertical, Loader2 } from "lucide-react";

type DocumentRole = "off" | "optional" | "required" | "conditional";

interface DocumentConfigRow {
  id: string;
  dealership_id: string;
  doc_id: string;
  label: string;
  description: string;
  role: DocumentRole;
  conditional_on: string | null;
  ocr_pipeline: string | null;
  customer_visible: boolean;
  staff_only: boolean;
  sort_order: number;
}

const ROLE_OPTIONS: Array<{ value: DocumentRole; label: string }> = [
  { value: "off",         label: "Off" },
  { value: "optional",    label: "Optional" },
  { value: "required",    label: "Required" },
  { value: "conditional", label: "Conditional" },
];

const HELPER = "How this document is collected. Conditional rows are only required when the customer's loan status matches (e.g. payoff statement only required when there's a loan).";

/**
 * Documents tab inside Capture & Inspection hub. Mirrors the Photos
 * tab structure (per-tenant table with editable label/description +
 * role pickers) but with documents' simpler role enum
 * (off / optional / required / conditional) and no boost dimension.
 *
 * Reads/writes document_config (migration
 * 20260507020000_document_config.sql). Soft-falls-back when the
 * migration hasn't applied so the screen never breaks while infra
 * catches up.
 */
const DocumentConfiguration = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [rows, setRows] = useState<DocumentConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missingTable, setMissingTable] = useState(false);

  const dealershipId = tenant.dealership_id;

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data: initialData, error } = await supabase
      .from("document_config" as never)
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("sort_order");
    let data = initialData;

    if (error) {
      // Migration not applied yet → table doesn't exist. Surface a
      // clear, in-context message instead of a generic failure.
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("relation")) {
        setMissingTable(true);
        setLoading(false);
        return;
      }
    }

    if (!data || (data as unknown[]).length === 0) {
      const { data: defaults } = await supabase
        .from("document_config" as never)
        .select("*")
        .eq("dealership_id", "default")
        .order("sort_order");

      if (defaults && (defaults as unknown[]).length > 0) {
        const cloned = (defaults as unknown as DocumentConfigRow[]).map((d) => ({
          dealership_id: dealershipId,
          doc_id: d.doc_id,
          label: d.label,
          description: d.description,
          role: d.role,
          conditional_on: d.conditional_on,
          ocr_pipeline: d.ocr_pipeline,
          customer_visible: d.customer_visible,
          staff_only: d.staff_only,
          sort_order: d.sort_order,
        }));
        await supabase.from("document_config" as never).insert(cloned as never);
        const res = await supabase
          .from("document_config" as never)
          .select("*")
          .eq("dealership_id", dealershipId)
          .order("sort_order");
        data = res.data;
      }
    }

    if (data) setRows(data as unknown as DocumentConfigRow[]);
    setLoading(false);
  }, [dealershipId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateRow = (idx: number, patch: Partial<DocumentConfigRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        await supabase
          .from("document_config" as never)
          .update({
            label: row.label,
            description: row.description,
            role: row.role,
            conditional_on: row.conditional_on,
            customer_visible: row.customer_visible,
            staff_only: row.staff_only,
            sort_order: row.sort_order,
          } as never)
          .eq("id", row.id);
      }
      toast({ title: "Documents saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
    setSaving(false);
  };

  const requiredCount    = rows.filter((d) => d.role === "required" && d.customer_visible).length;
  const conditionalCount = rows.filter((d) => d.role === "conditional").length;
  const staffOnlyCount   = rows.filter((d) => d.staff_only).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missingTable) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Documents not enabled yet</h3>
          <p className="text-xs text-muted-foreground">
            The document configuration table doesn't exist in this database yet. Apply migration
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">
              20260507020000_document_config.sql
            </code>
            via Lovable's "Push to Supabase" or the Supabase SQL editor, then refresh this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Documents
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Driver's license, title, registration, payoff statement. The customer portal renders only customer-visible docs; the dealer's customer-file uploader can attach the full list including staff-only items.
            Settings are unique to <strong>{tenant.display_name || "this rooftop"}</strong>.
          </p>
        </div>
        <Badge variant="secondary">Dealer admin</Badge>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Document list</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Each row controls how the document is collected and where it appears. Rows marked OCR auto-fill feed downstream auto-population (driver's license → name/DOB/address; title → VIN/owner).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-micro">Required — {requiredCount}</Badge>
              <Badge variant="outline" className="text-micro">Conditional — {conditionalCount}</Badge>
              <Badge variant="outline" className="text-micro">Staff-only — {staffOnlyCount}</Badge>
            </div>
          </div>

          <div className="hidden md:grid md:grid-cols-[1fr_minmax(240px,300px)_140px] gap-3 px-2 pt-2 pb-1 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <div>Document</div>
            <div>Role</div>
            <div>Visibility</div>
          </div>

          <div className="space-y-2">
            {rows.map((doc, idx) => {
              const isOff = doc.role === "off";
              const showCondPicker = doc.role === "conditional";
              return (
                <div
                  key={doc.id}
                  className={`flex flex-col md:grid md:grid-cols-[1fr_minmax(240px,300px)_140px] gap-3 py-2.5 px-3 rounded-lg border bg-card transition-colors ${
                    isOff ? "border-border opacity-70" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={doc.label}
                          onChange={(e) => updateRow(idx, { label: e.target.value })}
                          className="h-7 text-sm font-semibold w-56"
                        />
                        {doc.ocr_pipeline && (
                          <Badge variant="outline" className="text-micro border-success/40 text-success">
                            OCR auto-fill
                          </Badge>
                        )}
                      </div>
                      <Input
                        value={doc.description}
                        onChange={(e) => updateRow(idx, { description: e.target.value })}
                        className="h-6 text-xs text-muted-foreground border-none p-0 mt-0.5"
                        placeholder="Instruction for customer..."
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 self-start" title={HELPER}>
                    <div className="inline-flex p-0.5 rounded-lg border border-border bg-muted/30 self-start">
                      {ROLE_OPTIONS.map((opt) => {
                        const selected = opt.value === doc.role;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateRow(idx, {
                              role: opt.value,
                              conditional_on: opt.value === "conditional"
                                ? (doc.conditional_on || "has_loan")
                                : null,
                            })}
                            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {showCondPicker && (
                      <select
                        value={doc.conditional_on || "has_loan"}
                        onChange={(e) => updateRow(idx, { conditional_on: e.target.value })}
                        className="h-7 text-xs rounded-md border border-border bg-background px-2 text-foreground"
                      >
                        <option value="has_loan">When customer has a loan</option>
                        <option value="has_lease">When customer has a lease</option>
                      </select>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 self-start text-xs">
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateRow(idx, { customer_visible: true, staff_only: false })}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          !doc.staff_only
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        Customer + Dealer
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRow(idx, { customer_visible: false, staff_only: true })}
                        className={`px-2.5 py-1 text-xs font-medium border-l border-border transition-colors ${
                          doc.staff_only
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        Dealer only
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => fetchConfig()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save documents
        </Button>
      </div>
    </div>
  );
};

export default DocumentConfiguration;

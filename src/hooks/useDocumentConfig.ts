import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DocumentRole = "off" | "optional" | "required" | "conditional";
export type DocumentConditionalOn = "has_loan" | "has_lease" | null;

export interface DocumentConfig {
  id: string;
  doc_id: string;
  label: string;
  description: string;
  role: DocumentRole;
  conditional_on: DocumentConditionalOn;
  ocr_pipeline: string | null;
  customer_visible: boolean;
  staff_only: boolean;
  sort_order: number;
}

/**
 * Fetches document configuration for a dealership. Mirrors
 * usePhotoConfig (one screen, one catalog, per-tenant scoping) but
 * without the boost dimension — documents have no AI re-review path.
 *
 * Selectors give each surface a focused view:
 *   - customerRequiredDocs : 'required' AND customer_visible
 *   - customerOptionalDocs : 'optional' AND customer_visible
 *   - customerAllDocs      : every customer-visible doc with role != 'off'
 *   - conditionalDocs      : 'conditional' rows + their `conditional_on`
 *                            so the portal can flip them on once loan
 *                            status is known
 *   - staffOnlyDocs        : staff_only true (admin uploader catalog)
 *
 * Pass `loanStatus` so 'conditional' docs resolve correctly:
 *   - has_loan  → payoff_verification becomes required
 *   - lease     → lease_buyout becomes required
 *   - anything else → conditional rows fall back to optional
 */
export const useDocumentConfig = (
  dealershipId: string = "default",
  loanStatus?: string | null,
) => {
  const [docs, setDocs] = useState<DocumentConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      let { data } = await supabase
        .from("document_config" as never)
        .select("*")
        .eq("dealership_id", dealershipId)
        .order("sort_order");

      if (!data || data.length === 0) {
        const res = await supabase
          .from("document_config" as never)
          .select("*")
          .eq("dealership_id", "default")
          .order("sort_order");
        data = res.data;
      }

      if (data) {
        setDocs((data as unknown as DocumentConfig[]).map((d) => ({
          id: d.id,
          doc_id: d.doc_id,
          label: d.label,
          description: d.description,
          role: d.role,
          conditional_on: d.conditional_on,
          ocr_pipeline: d.ocr_pipeline,
          customer_visible: d.customer_visible,
          staff_only: d.staff_only,
          sort_order: d.sort_order,
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [dealershipId]);

  // Resolve 'conditional' rows against the customer's loan_status.
  // When loanStatus is unknown (undefined) we treat conditional rows
  // as optional so the customer can still upload them voluntarily.
  const resolvedRole = (d: DocumentConfig): DocumentRole => {
    if (d.role !== "conditional") return d.role;
    if (loanStatus == null) return "optional";
    if (d.conditional_on === "has_loan"  && loanStatus === "has_loan")  return "required";
    if (d.conditional_on === "has_lease" && loanStatus === "lease")     return "required";
    return "optional";
  };

  const customerVisible = docs.filter((d) => d.customer_visible);
  const customerRequiredDocs = customerVisible.filter((d) => resolvedRole(d) === "required");
  const customerOptionalDocs = customerVisible.filter((d) => resolvedRole(d) === "optional");
  const customerAllDocs      = customerVisible.filter((d) => resolvedRole(d) !== "off");
  const conditionalDocs      = docs.filter((d) => d.role === "conditional");
  const staffOnlyDocs        = docs.filter((d) => d.staff_only);

  return {
    docs,
    customerRequiredDocs,
    customerOptionalDocs,
    customerAllDocs,
    conditionalDocs,
    staffOnlyDocs,
    resolveRole: resolvedRole,
    loading,
  };
};

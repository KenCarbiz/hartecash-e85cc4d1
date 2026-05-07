import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const FormConfiguration = React.lazy(() => import("./FormConfiguration"));
const InspectionConfiguration = React.lazy(() => import("./InspectionConfiguration"));
const PhotoConfiguration = React.lazy(() => import("./PhotoConfiguration"));
const DocumentConfiguration = React.lazy(() => import("./DocumentConfiguration"));
const DepthPolicyManager = React.lazy(() => import("./DepthPolicyManager"));

interface CaptureInspectionHubProps {
  /** Deep-link tab from legacy keys:
   *  "form-config"        → lead-form
   *  "inspection-config"  → inspection-sheet
   *  "photo-config"       → photos
   *  "document-config"    → documents
   *  "depth-policies"     → standards
   *  "capture-inspection" → lead-form (default) */
  initialTab?: "lead-form" | "inspection-sheet" | "photos" | "documents" | "standards";
}

/**
 * Capture & Inspection hub — every surface that defines what data the
 * customer / inspector captures on its own tab:
 *
 *   - Lead Form        — public sell-flow questions (FormConfiguration)
 *   - Inspection Sheet — staff inspection field set (InspectionConfiguration)
 *   - Photos           — required photo angles + overlay (PhotoConfiguration)
 *   - Documents        — DL / title / registration / payoff catalog
 *                        (DocumentConfiguration). DL + title rows carry
 *                        OCR pipelines that auto-populate the customer
 *                        detail page on upload.
 *   - Standards        — tire/brake depth tier definitions (DepthPolicyManager)
 *
 * Admins typically edit these together (a new lead-form question often
 * implies a matching inspection-sheet field, and a new photo angle
 * implies a new requirement). Tabs keep them one click apart.
 */
const CaptureInspectionHub = ({
  initialTab = "lead-form",
}: CaptureInspectionHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Capture & Inspection</h2>
        <p className="text-sm text-muted-foreground">
          Configure the data your customers and inspectors capture across every step.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="lead-form">Lead Form</TabsTrigger>
          <TabsTrigger value="inspection-sheet">Inspection Sheet</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="standards">Standards</TabsTrigger>
        </TabsList>

        <TabsContent value="lead-form" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <FormConfiguration />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="inspection-sheet" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <InspectionConfiguration />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="photos" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <PhotoConfiguration />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <DocumentConfiguration />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="standards" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <DepthPolicyManager />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaptureInspectionHub;

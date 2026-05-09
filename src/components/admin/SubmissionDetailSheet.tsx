/**
 * SubmissionDetailSheet — thin wrapper that delegates to Classic.
 *
 * Until the Tier-0 cleanup this file was a 3,058-line dead "V2 layout"
 * + a one-line wrapper at the bottom that rendered Classic anyway.
 * The V2 body was never reached — `export default function
 * SubmissionDetailSheet(props) { return <SubmissionDetailSheetClassic
 * {...props} />; }` was the live behavior.
 *
 * Removing the dead body shrinks the file ~99% and removes ~5,000
 * lines of code-health debt (the audit flagged it as the single
 * biggest dead-weight in the repo). If the V2 conversation-first
 * variant ships in a future PR, it will land as `CustomerFileV2.tsx`
 * which already exists and is the lazy-loaded path on the
 * conversation-first config flag. This file's only job is to keep
 * existing imports working.
 */

import type { Submission, DealerLocation } from "@/lib/adminConstants";
import SubmissionDetailSheetClassic from "./SubmissionDetailSheetClassic";

export interface SubmissionDetailSheetProps {
  selected: Submission | null;
  onClose: () => void;
  photos: { url: string; name: string }[];
  docs: { name: string; url: string; type: string }[];
  activityLog: {
    id: string;
    action: string;
    old_value: string | null;
    new_value: string | null;
    performed_by: string | null;
    created_at: string;
  }[];
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
  /** Viewer's role — passed to the Classic slide-out so it can
   *  auto-scroll to the section that role works from on open. */
  viewerRole?: string;
  onUpdate: (updated: Submission) => void;
  onDelete: (id: string) => void;
  onRefresh: (sub: Submission) => void;
  onScheduleAppointment: (sub: Submission) => void;
  onDeletePhoto: (fileName: string) => void;
  onDeleteDoc: (docType: string, fileName: string) => void;
  fetchActivityLog: (id: string) => void;
  fetchSubmissions: () => void;
}

export default function SubmissionDetailSheet(props: SubmissionDetailSheetProps) {
  return <SubmissionDetailSheetClassic {...props} />;
}

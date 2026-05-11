/**
 * AppraisalPhotosCard — collapsed-by-default evidence panel for the
 * appraisal screen.
 *
 * Why this exists: the appraiser is setting the final ACV and
 * deductions. Their job is "defend this number." The evidence they
 * defend against — customer photos, staff inspection photos, AI
 * condition findings — needs to be on the same screen. Forcing them
 * to navigate back to the customer file to see a photo breaks flow
 * and creates a defensibility hole when a customer disputes the
 * offer later.
 *
 * Design (from May 2026 UX discussion):
 *   - Collapsed by default — appraisal screen is data-heavy and a
 *     20-photo gallery expanded by default pushes deduction inputs
 *     below the fold.
 *   - The collapsed header must EARN its row: counts, AI flag
 *     strip, and 5-thumb preview together signal what's worth
 *     expanding.
 *   - When AI flagged condition issues the customer didn't mention,
 *     surface a red dot — that's the case where the appraiser must
 *     look before setting the offer.
 *   - Click anywhere on the header to expand.
 *   - Hide entirely when zero photos.
 *
 * Sources:
 *   - submission-photos/{token}/  — both customer-flow and staff-
 *     uploaded vehicle photos (same bucket; no convention separates
 *     them yet, so the gallery is consolidated).
 *   - useLatestOfferBump — the AI condition findings live here as
 *     line_items[].label / amount / source.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Images, ChevronDown, ChevronUp, AlertTriangle, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLatestOfferBump } from "@/hooks/useLatestOfferBump";
import { Button } from "@/components/ui/button";

interface PhotoEntry {
  name: string;
  url: string;
  created_at: string | null;
  size: number | null;
  source: "staff" | "customer";
}

/**
 * Customer-flow uploads use prefixes like front- / back- / dashboard-
 * (catIds set on the customer upload page) and extra- (manual adds).
 * Staff-uploaded photos via StaffFileUpload are prefixed staff-.
 * Detection is purely by filename; no schema change needed.
 */
function classifyPhotoSource(filename: string): "staff" | "customer" {
  return filename.startsWith("staff-") ? "staff" : "customer";
}

interface AppraisalPhotosCardProps {
  submissionId: string | null;
  token: string | null;
  className?: string;
}

export default function AppraisalPhotosCard({
  submissionId,
  token,
  className,
}: AppraisalPhotosCardProps) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "customer" | "staff">("all");

  // Audit-log every time staff opens the photos for a submission.
  // Fired ONCE per (submission, mount) on the first expand so a
  // manager toggling open/closed doesn't flood the access log.
  // Resource kind 'photo_view' was added to the enum in migration
  // 20260509070000_audit_photo_view.sql; the call soft-fails when
  // that migration hasn't been applied yet.
  const photoViewLoggedRef = useRef(false);

  const { bump } = useLatestOfferBump(submissionId);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from("submission-photos")
        .list(token, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (cancelled) return;
      if (error || !data) {
        setPhotos([]);
        setLoading(false);
        return;
      }
      const rows: PhotoEntry[] = data
        .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from("submission-photos")
            .getPublicUrl(`${token}/${f.name}`).data.publicUrl,
          created_at: f.created_at ?? null,
          size: f.metadata && typeof f.metadata.size === "number"
            ? f.metadata.size
            : null,
          source: classifyPhotoSource(f.name),
        }));
      setPhotos(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // AI flags worth surfacing in the collapsed header — anything from
  // the offer-bump line items that suggests condition the customer
  // didn't represent (positive amount = AI found something more or
  // better than rated). We keep the labels short and dedupe.
  const aiFlags = useMemo(() => {
    const items = bump?.line_items ?? [];
    const labels = items
      .filter((i) => i.amount > 0 && typeof i.label === "string")
      .map((i) => i.label.trim())
      .filter((l) => l.length > 0);
    return Array.from(new Set(labels)).slice(0, 4);
  }, [bump]);

  // Hide the section entirely when there's nothing to show. The
  // appraisal screen is dense; an empty row is wasted attention.
  if (loading) return null;
  if (photos.length === 0) return null;

  const hasAiFlags = aiFlags.length > 0;
  const customerCount = photos.filter((p) => p.source === "customer").length;
  const staffCount    = photos.filter((p) => p.source === "staff").length;
  const previewStrip = photos.slice(0, 5);
  const remaining = photos.length - previewStrip.length;

  const filteredPhotos = sourceFilter === "all"
    ? photos
    : photos.filter((p) => p.source === sourceFilter);

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${
      hasAiFlags ? "border-amber-300 dark:border-amber-700"
                 : "border-border"
    } ${className ?? ""}`}>
      {/* ── COLLAPSED HEADER ── */}
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => {
            // First open per mount → write audit row. We can't infer
            // expansion from state inside the setter (we're about to
            // flip it), so log on the !v branch (which is the "about
            // to be expanded" branch).
            if (!v && !photoViewLoggedRef.current && submissionId) {
              photoViewLoggedRef.current = true;
              void Promise.resolve(
                supabase.rpc("log_customer_data_access", {
                  _submission_id: submissionId,
                  _voice_call_id: null,
                  _resource_kind: "photo_view",
                  _request_path: typeof window !== "undefined"
                    ? window.location.pathname
                    : null,
                  _metadata: {
                    photo_count: photos.length,
                    customer_count: photos.filter((p) => p.source === "customer").length,
                    staff_count: photos.filter((p) => p.source === "staff").length,
                    has_ai_flags: hasAiFlags,
                  },
                })
              ).catch(() => {
                /* Soft-fail. Migration 20260509070000 may not be
                 * applied yet; the access-log feature is value-
                 * additive, not blocking. */
              });
            }
            return !v;
          });
        }}
        className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
            hasAiFlags ? "bg-amber-100 dark:bg-amber-900/40"
                       : "bg-muted"
          }`}>
            <Images className={`w-4 h-4 ${
              hasAiFlags ? "text-amber-600 dark:text-amber-400"
                         : "text-muted-foreground"
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-card-foreground">
                Photos &amp; Evidence
              </h3>
              <span className="text-xs text-muted-foreground">
                {customerCount > 0 && staffCount > 0 ? (
                  <>
                    {customerCount} customer · {staffCount} staff
                  </>
                ) : staffCount > 0 ? (
                  <>{staffCount} staff {staffCount === 1 ? "photo" : "photos"}</>
                ) : (
                  <>{customerCount} customer {customerCount === 1 ? "photo" : "photos"}</>
                )}
              </span>
              {hasAiFlags && (
                <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider font-bold rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  AI flagged
                </span>
              )}
            </div>

            {hasAiFlags && (
              <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="leading-snug">
                  {aiFlags.join(" · ")}
                </span>
              </div>
            )}

            {/* Thumbnail preview strip — Staff-uploaded photos get
                a small "S" pill in the corner so the appraiser can
                tell at a glance whether the most recent shots are
                ours or the customer's. */}
            <div className="mt-3 flex items-center gap-1.5">
              {previewStrip.map((p) => (
                <div
                  key={p.name}
                  className="relative w-12 h-12 rounded border border-border bg-muted overflow-hidden shrink-0"
                >
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {p.source === "staff" && (
                    <span
                      className="absolute bottom-0 left-0 right-0 text-[8px] font-bold uppercase tracking-wider text-white bg-blue-600/85 text-center leading-tight py-px"
                      aria-label="Staff-uploaded photo"
                    >
                      Staff
                    </span>
                  )}
                </div>
              ))}
              {remaining > 0 && (
                <span className="ml-1 text-[11px] text-muted-foreground font-medium">
                  +{remaining} more
                </span>
              )}
            </div>
          </div>

          <span className="shrink-0 mt-1 text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {/* ── EXPANDED GALLERY ── */}
      {expanded && (
        <div className="border-t border-border p-4 bg-muted/20">
          {/* Source-filter tabs — only render when BOTH sources have
              photos. Otherwise the tabs are noise. */}
          {customerCount > 0 && staffCount > 0 && (
            <div className="mb-3 inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
              {(["all", "customer", "staff"] as const).map((key) => {
                const active = sourceFilter === key;
                const count = key === "all" ? photos.length
                  : key === "customer" ? customerCount
                  : staffCount;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSourceFilter(key)}
                    className={`px-3 py-1.5 rounded uppercase tracking-wider font-semibold transition ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {key} <span className="opacity-70 font-mono ml-0.5">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {filteredPhotos.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  // Lightbox indexes off the FULL photos array so
                  // ±navigation works regardless of the current
                  // filter selection.
                  const idx = photos.findIndex((x) => x.name === p.name);
                  if (idx >= 0) setLightboxIdx(idx);
                }}
                className="relative aspect-square rounded-md border border-border bg-card overflow-hidden hover:ring-2 hover:ring-primary transition"
              >
                <img
                  src={p.url}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {p.source === "staff" && (
                  <span className="absolute top-1 left-1 text-[9px] font-bold uppercase tracking-wider text-white bg-blue-600/90 rounded px-1.5 py-0.5">
                    Staff
                  </span>
                )}
              </button>
            ))}
          </div>

          {hasAiFlags && bump?.line_items && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1.5">
                AI condition findings (from offer-bump audit)
              </div>
              <div className="space-y-1">
                {bump.line_items
                  .filter((i) => i.amount > 0)
                  .map((item, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="text-amber-900 dark:text-amber-100">{item.label}</span>
                      <span className="font-mono font-semibold text-amber-800 dark:text-amber-200">
                        +${item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightboxIdx != null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
            aria-label="Close lightbox"
          >
            <X className="w-5 h-5" />
          </Button>
          <img
            src={photos[lightboxIdx].url}
            alt={photos[lightboxIdx].name}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm font-mono">
            {lightboxIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}

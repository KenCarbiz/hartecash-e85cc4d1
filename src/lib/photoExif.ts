/**
 * Photo EXIF verifier — parses GPS, capture timestamp, camera/software
 * tags from a customer-uploaded photo and grades how trustworthy the
 * upload is. Powers the verified/likely/unverified/suspicious badge
 * on customer + staff photo tiles, and persists to `photo_metadata`.
 *
 * Tier rules (graceful — absence of EXIF is NOT fraud, since iCloud,
 * WhatsApp, iMessage etc. strip it):
 *
 *   verified    GPS present + taken within 30 days + within 50 mi of
 *               expected location (customer ZIP or dealership rooftop)
 *   likely      GPS present + within 50 mi OR fresh (<24h) with no GPS
 *   unverified  No EXIF / no GPS and no other strong signal
 *   suspicious  GPS > 500 mi away, OR DateTimeOriginal > 1 year stale,
 *               OR software tag is a screenshot/editor (Instagram,
 *               Snapchat, Photoshop, etc.)
 */
import exifr from "exifr";
import { supabase } from "@/integrations/supabase/client";

export type PhotoTrustTier = "verified" | "likely" | "unverified" | "suspicious";

export interface PhotoExifResult {
  has_exif: boolean;
  has_gps: boolean;
  gps_lat: number | null;
  gps_lng: number | null;
  taken_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  software: string | null;
  distance_miles: number | null;
  freshness_hours: number | null;
  trust_tier: PhotoTrustTier;
  trust_reasons: string[];
}

const SUSPICIOUS_SOFTWARE = [
  "instagram", "snapchat", "tiktok", "facebook", "messenger",
  "photoshop", "lightroom", "gimp", "screenshot",
];

const haversineMiles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const parsePhotoExif = async (
  file: File,
  expected?: { lat: number | null; lng: number | null } | null,
): Promise<PhotoExifResult> => {
  const empty: PhotoExifResult = {
    has_exif: false, has_gps: false,
    gps_lat: null, gps_lng: null,
    taken_at: null, camera_make: null, camera_model: null, software: null,
    distance_miles: null, freshness_hours: null,
    trust_tier: "unverified", trust_reasons: ["No EXIF metadata (likely shared via iMessage/WhatsApp or screenshot)"],
  };

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (await exifr.parse(file, {
      gps: true,
      pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate", "Make", "Model", "Software"],
    })) as Record<string, unknown> | null;
  } catch {
    return empty;
  }
  if (!parsed) return empty;

  const lat = typeof parsed.latitude === "number" ? (parsed.latitude as number) : null;
  const lng = typeof parsed.longitude === "number" ? (parsed.longitude as number) : null;
  const dateRaw = (parsed.DateTimeOriginal || parsed.CreateDate) as Date | string | undefined;
  const takenAt = dateRaw ? new Date(dateRaw as never) : null;
  const make = (parsed.Make as string) || null;
  const model = (parsed.Model as string) || null;
  const software = (parsed.Software as string) || null;

  const reasons: string[] = [];
  let tier: PhotoTrustTier = "unverified";
  const hasGps = lat != null && lng != null;

  let distanceMi: number | null = null;
  if (hasGps && expected?.lat != null && expected?.lng != null) {
    distanceMi = haversineMiles({ lat: lat!, lng: lng! }, { lat: expected.lat, lng: expected.lng });
  }

  let freshnessHours: number | null = null;
  if (takenAt && !isNaN(takenAt.getTime())) {
    freshnessHours = (Date.now() - takenAt.getTime()) / 36e5;
  }

  // Suspicious gates first
  if (software && SUSPICIOUS_SOFTWARE.some((s) => software.toLowerCase().includes(s))) {
    tier = "suspicious";
    reasons.push(`Edited or shared via ${software}`);
  }
  if (distanceMi != null && distanceMi > 500) {
    tier = "suspicious";
    reasons.push(`Photo GPS is ${Math.round(distanceMi)} mi from expected location`);
  }
  if (freshnessHours != null && freshnessHours > 24 * 365) {
    tier = "suspicious";
    reasons.push(`Photo is over a year old (taken ${takenAt?.toLocaleDateString()})`);
  }

  if (tier !== "suspicious") {
    if (hasGps && distanceMi != null && distanceMi <= 50 && freshnessHours != null && freshnessHours <= 24 * 30) {
      tier = "verified";
      reasons.push(`GPS within ${Math.round(distanceMi)} mi of expected location`);
      if (freshnessHours <= 48) reasons.push("Taken in the last 48 hours");
    } else if (hasGps && distanceMi != null && distanceMi <= 50) {
      tier = "verified";
      reasons.push(`GPS within ${Math.round(distanceMi)} mi of expected location`);
    } else if (hasGps && (distanceMi == null || distanceMi <= 250)) {
      tier = "likely";
      reasons.push(distanceMi != null
        ? `GPS ${Math.round(distanceMi)} mi from expected (within region)`
        : "GPS present (no expected location to compare)");
    } else if (freshnessHours != null && freshnessHours <= 24) {
      tier = "likely";
      reasons.push("Captured within the last 24 hours");
    } else if (make || model) {
      tier = "unverified";
      reasons.push(`Camera: ${[make, model].filter(Boolean).join(" ")} (no GPS)`);
    } else {
      tier = "unverified";
      reasons.push("No GPS or capture timestamp found");
    }
  }

  return {
    has_exif: true,
    has_gps: hasGps,
    gps_lat: lat,
    gps_lng: lng,
    taken_at: takenAt && !isNaN(takenAt.getTime()) ? takenAt.toISOString() : null,
    camera_make: make,
    camera_model: model,
    software,
    distance_miles: distanceMi,
    freshness_hours: freshnessHours,
    trust_tier: tier,
    trust_reasons: reasons,
  };
};

/**
 * Persist a parsed EXIF result to `photo_metadata`. Fire-and-forget
 * from upload handlers — failures here should never block the upload
 * itself.
 */
export const savePhotoMetadata = async (params: {
  submissionId: string;
  submissionToken: string | null;
  storageBucket?: string;
  storagePath: string;
  photoCategory?: string | null;
  expected?: { lat: number | null; lng: number | null; source?: string } | null;
  exif: PhotoExifResult;
}) => {
  try {
    await supabase.from("photo_metadata" as never).upsert(
      {
        submission_id: params.submissionId,
        submission_token: params.submissionToken,
        storage_bucket: params.storageBucket || "submission-photos",
        storage_path: params.storagePath,
        photo_category: params.photoCategory ?? null,
        has_exif: params.exif.has_exif,
        has_gps: params.exif.has_gps,
        gps_lat: params.exif.gps_lat,
        gps_lng: params.exif.gps_lng,
        taken_at: params.exif.taken_at,
        camera_make: params.exif.camera_make,
        camera_model: params.exif.camera_model,
        software: params.exif.software,
        distance_miles: params.exif.distance_miles,
        expected_lat: params.expected?.lat ?? null,
        expected_lng: params.expected?.lng ?? null,
        expected_source: params.expected?.source ?? null,
        freshness_hours: params.exif.freshness_hours,
        trust_tier: params.exif.trust_tier,
        trust_reasons: params.exif.trust_reasons,
      } as never,
      { onConflict: "submission_id,storage_path" } as never,
    );
  } catch (e) {
    console.warn("savePhotoMetadata failed:", e);
  }
};

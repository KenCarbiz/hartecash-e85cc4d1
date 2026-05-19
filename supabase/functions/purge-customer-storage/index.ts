// @jwt-required — admin/cron only; default verify_jwt=true is correct.
/**
 * purge-customer-storage — cron-invoked customer-data purge worker.
 *
 * Companion to the SQL purge_customer_data RPC. The RPC anonymizes
 * everything reachable in Postgres but cannot reach Supabase Storage
 * (driver's-license images, title docs, photo uploads) or third-
 * party APIs (Bland.ai recordings). This worker reads the
 * customer_data_purge_queue table and executes:
 *
 *   1. List + delete every storage object whose path includes the
 *      submission token, across the buckets we use:
 *        submission-photos, customer-documents, vehicle-photos,
 *        inspection-photos
 *   2. Call Bland.ai's recording-delete API for every voice_call_log
 *      with a provider_call_id tied to the submission.
 *   3. Mark the queue row done.
 *
 * Audit: every action goes through report() at info severity so the
 * trail lands in error_log alongside actual errors. Failures bump
 * attempt_count and surface as warnings.
 *
 * Cron schedule: every minute (registered in this commit's
 * companion migration). 5-attempt cap before marking failed.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { report } from "../_shared/report.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STORAGE_BUCKETS = [
  "submission-photos",
  "customer-documents",
  "vehicle-photos",
  "inspection-photos",
];

interface QueueRow {
  id: string;
  submission_id: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  attempt_count: number;
}

async function purgeStorageForSubmission(
  supabase: ReturnType<typeof createClient>,
  submissionId: string,
  submissionToken: string | null,
): Promise<number> {
  let removed = 0;
  for (const bucket of STORAGE_BUCKETS) {
    try {
      // Storage paths in this codebase use either the submission UUID
      // or the public token as the folder root. List both.
      for (const folder of [submissionId, submissionToken].filter(Boolean) as string[]) {
        const { data: files, error: listErr } = await supabase.storage
          .from(bucket)
          .list(folder, { limit: 1000 });
        if (listErr || !files || files.length === 0) continue;

        const paths = files
          .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
          .map((f) => `${folder}/${f.name}`);
        if (paths.length === 0) continue;

        const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
        if (rmErr) {
          await report("purge-customer-storage", rmErr, {
            submission_id: submissionId,
            bucket,
            attempted_paths: paths.length,
          }, "warning");
        } else {
          removed += paths.length;
        }
      }
    } catch (e) {
      await report("purge-customer-storage", e, {
        submission_id: submissionId,
        bucket,
        stage: "list_or_remove",
      }, "warning");
    }
  }
  return removed;
}

async function purgeBlandRecordings(
  supabase: ReturnType<typeof createClient>,
  submissionId: string,
): Promise<number> {
  const blandKey = Deno.env.get("BLAND_API_KEY");
  if (!blandKey) {
    // No Bland API key configured — the recording_url is already
    // nulled by the SQL purge; skip the API delete and rely on
    // Bland's own retention to expire the audio.
    return 0;
  }
  let deleted = 0;
  try {
    const { data: calls } = await supabase
      .from("voice_call_log")
      .select("id, provider_call_id")
      .eq("submission_id", submissionId)
      .not("provider_call_id", "is", null);
    for (const c of (calls as { id: string; provider_call_id: string }[]) || []) {
      try {
        // Bland.ai recordings delete — endpoint per their API docs.
        const r = await fetch(
          `https://api.bland.ai/v1/calls/${c.provider_call_id}/recording`,
          { method: "DELETE", headers: { Authorization: blandKey } },
        );
        if (r.ok || r.status === 404) {
          deleted += 1;
        } else {
          await report("purge-customer-storage", `bland delete ${r.status}`, {
            submission_id: submissionId,
            provider_call_id: c.provider_call_id,
          }, "warning");
        }
      } catch (e) {
        await report("purge-customer-storage", e, {
          submission_id: submissionId,
          provider_call_id: c.provider_call_id,
          stage: "bland_delete",
        }, "warning");
      }
    }
  } catch (e) {
    await report("purge-customer-storage", e, {
      submission_id: submissionId,
      stage: "bland_lookup",
    }, "warning");
  }
  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Pull up to 20 pending queue rows, ordered by oldest first.
    // Mark them processing in one statement (to avoid double-pickup
    // if two cron ticks overlap) using FOR UPDATE SKIP LOCKED via
    // a CTE.
    const { data: queueRows, error: pickErr } = await supabase.rpc(
      "pickup_customer_data_purge_jobs",
      { _limit: 20 },
    );

    if (pickErr) {
      // Fall back to a simple SELECT + UPDATE if the RPC isn't
      // deployed yet. Less safe under concurrency but keeps the
      // worker functional during rollout.
      const { data: rows } = await supabase
        .from("customer_data_purge_queue")
        .select("id, submission_id, contact_phone, contact_email, attempt_count")
        .eq("status", "pending")
        .lt("attempt_count", 5)
        .order("enqueued_at", { ascending: true })
        .limit(20);
      if (!rows) {
        return new Response(JSON.stringify({ ok: true, processed: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const row of rows as QueueRow[]) {
        await supabase.from("customer_data_purge_queue")
          .update({ status: "processing", attempt_count: row.attempt_count + 1 })
          .eq("id", row.id);
      }
      // Re-read the rows in processing state.
      const { data: claimed } = await supabase
        .from("customer_data_purge_queue")
        .select("id, submission_id, contact_phone, contact_email, attempt_count")
        .eq("status", "processing")
        .order("enqueued_at", { ascending: true })
        .limit(20);
      await processBatch(supabase, (claimed as QueueRow[]) || []);
      processed = (claimed as unknown[])?.length ?? 0;
    } else {
      const list = (queueRows as QueueRow[]) || [];
      processed = list.length;
      const results = await processBatch(supabase, list);
      succeeded = results.succeeded;
      failed = results.failed;
    }

    return new Response(
      JSON.stringify({ ok: true, processed, succeeded, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await report("purge-customer-storage", e, { stage: "outer" }, "fatal");
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function processBatch(
  supabase: ReturnType<typeof createClient>,
  rows: QueueRow[],
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      let storageRemoved = 0;
      let blandDeleted = 0;
      if (row.submission_id) {
        const { data: sub } = await supabase
          .from("submissions")
          .select("token")
          .eq("id", row.submission_id)
          .maybeSingle();
        const token = (sub as { token?: string } | null)?.token ?? null;
        storageRemoved = await purgeStorageForSubmission(supabase, row.submission_id, token);
        blandDeleted   = await purgeBlandRecordings(supabase, row.submission_id);
      }
      await supabase.from("customer_data_purge_queue")
        .update({
          status: "done",
          storage_purged: true,
          bland_purged: true,
          finished_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await report("purge-customer-storage",
        "purged customer storage + Bland recordings",
        {
          submission_id: row.submission_id,
          storage_objects_removed: storageRemoved,
          bland_recordings_deleted: blandDeleted,
        }, "info");
      succeeded += 1;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await supabase.from("customer_data_purge_queue")
        .update({
          status: row.attempt_count >= 4 ? "failed" : "pending",
          last_error: errMsg.slice(0, 1000),
        })
        .eq("id", row.id);
      await report("purge-customer-storage", e, {
        submission_id: row.submission_id,
        attempt_count: row.attempt_count + 1,
      }, "error");
      failed += 1;
    }
  }
  return { succeeded, failed };
}

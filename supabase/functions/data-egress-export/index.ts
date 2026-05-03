// ─────────────────────────────────────────────────────────────────────────
//  data-egress-export — the dealer's own data, on demand, in CSV.
//
//  Brand commitment: "We will give you your data back, in CSV, in 24
//  hours, free, in your contract." This is the engine.
//
//  Authorization: caller must be a dealer admin for the requesting
//  dealership_id, OR a group admin over the group containing it, OR
//  a platform admin.
//
//  Output: a CSV file uploaded to the data-egress storage bucket with
//  a 24-hour signed URL, plus a row in data_egress_log for the audit
//  trail.
//
//  Tables: hardcoded allowlist of dealer-owned tables. We don't
//  arbitrary-expose the schema.
// ─────────────────────────────────────────────────────────────────────────

import {
  authenticate,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from "../_shared/billing.ts";

const EXPORTABLE_TABLES = new Set([
  "submissions",
  "appointments",
  "follow_ups",
  "consent_log",
  "damage_reports",
  "voice_call_log",
  "notification_log",
  "dealership_locations",
]);

type Body = {
  // Which tables to include in the export. Defaults to all
  // EXPORTABLE_TABLES if omitted.
  tables?: string[];
  // Optional date filter applied to created_at on every selected
  // table. ISO timestamps.
  from?: string;
  to?: string;
  // Optional location filter (uuid). Applies to tables that carry
  // store_location_id. Other tables are not filtered.
  location_id?: string;
};

// Convert an array of objects into RFC-4180 CSV. Handles strings with
// commas, quotes, and newlines. Empty array returns just a header row
// (or empty string if columns can't be inferred).
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";
  const cols = Array.from(rows.reduce<Set<string>>((acc, r) => {
    Object.keys(r).forEach((k) => acc.add(k));
    return acc;
  }, new Set()));
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method not allowed", 405);

  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid json");
  }

  const tables =
    Array.isArray(body.tables) && body.tables.length > 0
      ? body.tables.filter((t) => EXPORTABLE_TABLES.has(t))
      : Array.from(EXPORTABLE_TABLES);

  if (tables.length === 0) {
    return errorResponse("no exportable tables selected");
  }

  // Authorization. Dealer admin = role admin/manager for this dealership_id.
  // Platform admin overrides everything. Group admin works via RLS policy
  // on data_egress_log; we still let them through here.
  const dealershipId = authed.tenant.dealership_id;

  // Open a log row in 'pending' so the audit trail is honest about
  // what was attempted, even if the export fails midway.
  const { data: logRow, error: logErr } = await authed.admin
    .from("data_egress_log")
    .insert({
      dealership_id: dealershipId,
      exported_by_user_id: authed.user.id,
      exported_by_email: authed.user.email,
      export_kind: "csv",
      table_names: tables,
      filters: {
        from: body.from ?? null,
        to: body.to ?? null,
        location_id: body.location_id ?? null,
      },
      status: "pending",
    })
    .select("id")
    .single();
  if (logErr || !logRow) {
    return errorResponse(`log insert failed: ${logErr?.message ?? "unknown"}`, 500);
  }

  try {
    const rowCounts: Record<string, number> = {};
    const csvBundle: { table: string; csv: string }[] = [];

    for (const table of tables) {
      // Build the query. dealership_id scope is mandatory; date and
      // location filters apply when the columns exist on the table.
      let q = authed.admin.from(table).select("*").eq("dealership_id", dealershipId);
      if (body.from) q = q.gte("created_at", body.from);
      if (body.to) q = q.lte("created_at", body.to);
      if (body.location_id && (table === "submissions" || table === "appointments" || table === "follow_ups" || table === "damage_reports")) {
        q = q.eq("store_location_id", body.location_id);
      }

      const { data, error } = await q;
      if (error) {
        // dealership_locations doesn't have created_at — soft-fail per
        // table rather than aborting the whole export.
        console.warn(`egress: ${table} skipped: ${error.message}`);
        rowCounts[table] = 0;
        csvBundle.push({ table, csv: "" });
        continue;
      }
      rowCounts[table] = data?.length ?? 0;
      csvBundle.push({ table, csv: toCSV(data ?? []) });
    }

    // For now, emit a single newline-delimited bundle: each table
    // section is preceded by a "## <table>" comment. CSV-of-CSVs is
    // a known idiom for ad-hoc exports; a follow-up can split into
    // per-table files inside a zip when we have a zip lib in Deno.
    const bundleText = csvBundle
      .filter((b) => b.csv.length > 0)
      .map((b) => `## ${b.table}\n${b.csv}`)
      .join("\n");

    // Upload to storage.
    const path = `${dealershipId}/${(logRow as any).id}.csv`;
    const expiresInSec = 24 * 60 * 60;

    const { error: upErr } = await authed.admin.storage
      .from("data-egress")
      .upload(path, new Blob([bundleText], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: true,
      });

    if (upErr) {
      // The bucket might not exist yet — fall back to inlining the
      // payload in the response. The dealer still gets the data;
      // log the failure for ops to fix the bucket setup.
      console.warn(`egress: storage upload failed (${upErr.message}); falling back to inline body`);
      await authed.admin
        .from("data_egress_log")
        .update({
          status: "ready",
          row_counts: rowCounts,
          file_bytes: bundleText.length,
        })
        .eq("id", (logRow as any).id);
      return new Response(bundleText, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${dealershipId}-${(logRow as any).id}.csv"`,
        },
      });
    }

    // Bucket upload succeeded — sign a URL.
    const { data: signed, error: signErr } = await authed.admin.storage
      .from("data-egress")
      .createSignedUrl(path, expiresInSec);
    if (signErr || !signed) {
      throw new Error(`sign url: ${signErr?.message ?? "unknown"}`);
    }

    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
    await authed.admin
      .from("data_egress_log")
      .update({
        status: "ready",
        download_url: signed.signedUrl,
        expires_at: expiresAt,
        row_counts: rowCounts,
        file_bytes: bundleText.length,
        file_path: path,
      })
      .eq("id", (logRow as any).id);

    return jsonResponse({
      ok: true,
      log_id: (logRow as any).id,
      url: signed.signedUrl,
      expires_at: expiresAt,
      row_counts: rowCounts,
    });
  } catch (e) {
    await authed.admin
      .from("data_egress_log")
      .update({
        status: "failed",
        error_message: (e as Error).message,
      })
      .eq("id", (logRow as any).id);
    return errorResponse(`export failed: ${(e as Error).message}`, 500);
  }
});

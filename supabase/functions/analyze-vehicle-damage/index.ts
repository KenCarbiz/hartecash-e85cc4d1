import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DamageItem {
  type: string;       // e.g. "dent", "scratch", "rust", "crack", "paint_chip"
  location: string;   // e.g. "front_bumper", "driver_door", "hood"
  severity: "minor" | "moderate" | "severe";
  description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submission_id, token, photo_category, photo_path } = await req.json();
    if (!submission_id || !photo_path || !photo_category) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tenant isolation. Anonymous customers (during their own form flow)
    // are allowed — submission_id is a UUID and acts as a capability token.
    // Authenticated staff, however, must belong to the submission's tenant.
    const caller = await resolveCaller(
      req,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      supabaseKey,
    );
    if (caller.kind === "tenant_staff") {
      const { data: subTenant } = await supabase
        .from("submissions")
        .select("dealership_id")
        .eq("id", submission_id)
        .maybeSingle();
      if (subTenant && subTenant.dealership_id !== caller.dealershipId) {
        return forbidden(corsHeaders);
      }
    }

    // Get signed URL for the photo
    const { data: signedData, error: signedErr } = await supabase.storage
      .from("submission-photos")
      .createSignedUrl(photo_path, 300);

    if (signedErr || !signedData?.signedUrl) {
      throw new Error(`Could not get signed URL: ${signedErr?.message}`);
    }

    // Per-category focus guidance. Each angle has a specific job — the
    // generic "look for damage" prompt misses the highest-value signals
    // (warning lights on a dashboard shot, tread depth on a tire shot,
    // panel-gap mismatch on a quarter-panel shot indicating prior collision).
    const CATEGORY_FOCUS: Record<string, string> = {
      front:
        "Front 3/4 angle. Check: bumper alignment, hood/fender panel gaps (accident sign), headlight clarity, grille damage, windshield chips, front bumper scuffs.",
      rear:
        "Rear 3/4 angle. Check: bumper alignment, trunk/tailgate panel gaps (rear-end sign), taillight clarity, exhaust tip rust, rear bumper scuffs.",
      driver_side:
        "Full driver side profile. Check: door dings, rocker-panel rust, paint mismatch between panels (repaint), wheel/tire visible condition, side-skirt damage.",
      passenger_side:
        "Full passenger side profile. Same checks as driver side.",
      dashboard:
        "Dashboard with engine running. CRITICAL SIGNALS: (1) read the odometer mileage — return the exact number. (2) identify every illuminated warning light (check engine, airbag/SRS, ABS, TPMS, oil pressure, battery, service engine soon, traction control). (3) look for excessive dash wear / sun damage / cracked dash pad.",
      interior:
        "Driver seat + steering wheel + front cabin. Check: seat rips / stains / heavy wear on the driver bolster, steering wheel leather condition, pedal rubber wear (mileage lie check), smoke residue on ceiling, aftermarket additions.",
      interior_rear:
        "Rear seats and floor. Check: stains, rips, pet damage, car-seat indentations, cargo-related wear, smoke staining on headliner.",
      windshield:
        "Windshield from inside. Check: chips, star cracks, long cracks (>6 in = replacement), delamination at edges, state inspection sticker validity.",
      wheel:
        "Tire + wheel close-up. CRITICAL SIGNALS: (1) estimate remaining tread depth in 32nds of an inch (new = 10-11/32; legal minimum = 2/32). (2) flag sidewall damage: bulges, cracks, curb rash on wheel. (3) note if tread is uneven (alignment issue) or if tire looks recently replaced (deep tread, fresh manufacturer markings). (4) note tire brand if readable — mismatched brands across axles reduces value.",
      hood:
        "Engine bay with hood open. Check: fluid leaks (oil, coolant, power steering), aftermarket parts (tune, intake, exhaust = harder to retail), non-factory welds or replaced fender liners (accident repair), battery corrosion, missing components.",
      damage:
        "Customer-called-out damage close-up. Assess severity and realistic repair cost category (minor cosmetic / moderate bodywork / severe structural).",
      // Legacy slot names from older seeds — keep working for back-compat.
      driver_rocker: "Driver rocker panel. Check rust along the sill, pitting, perforation, and impact damage from curb strikes.",
      pass_rocker: "Passenger rocker panel. Same checks as driver rocker.",
      trunk: "Trunk/cargo area. Check stains, wear, fluid leaks, and aftermarket additions.",
      driver_door: "Driver door interior panel. Check leather/vinyl condition, armrest wear, speaker grille damage, and window switch condition.",
      undercarriage: "Wheel well. Check rust in the inner arch, replaced fender liners (accident repair sign), and suspension condition.",
    };
    const focusLine = CATEGORY_FOCUS[photo_category] || "Assess any visible damage or wear.";

    // Call Lovable AI with the photo for damage analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an automotive appraiser scoring a customer-uploaded photo of a used vehicle being submitted for trade-in. The platform uses your output to adjust a cash offer up or down. Be specific and conservative — false positives reduce a real customer's offer, false negatives cost the dealer money at inspection.

Identify visible damage:
- type: dent, scratch, rust, paint_chip, crack, misaligned_panel, missing_part, stain, tear, wear, other
- location: specific panel (front_bumper, driver_door, hood, roof, rear_quarter_panel, windshield, dashboard, driver_seat, wheel, etc.)
- severity:
  - minor: cosmetic only, barely noticeable from 6 feet (e.g. light swirl marks, single scratch <2 inches, single chip <1 cm, light curb rash)
  - moderate: clearly visible but localized (e.g. door ding, fading clearcoat on one panel, multiple scratches, chipped paint)
  - severe: structural, multiple panels affected, accident damage, deep rust, missing trim, cracked windshield, deployed airbag visible
- description: one short factual sentence

Photo-category focus for THIS shot ("${photo_category}"): ${focusLine}

In addition to damage, populate the verification fields when the photo shows them:
- mileage_reading: for dashboard photos, the exact odometer number you can read (null if not a dashboard shot or unreadable)
- warning_lights: for dashboard photos, array of any illuminated warning lights you see (check_engine, airbag, abs, tpms, oil_pressure, battery, service_engine, traction_control, other)
- tire_tread_32nds: for tire photos, your best estimate of remaining tread in 32nds of an inch (new = 10-11, worn limit = 2)
- tire_issues: for tire photos, array of any issues (sidewall_bulge, sidewall_crack, curb_rash_on_wheel, uneven_wear, looks_new, looks_worn, other)
- paint_mismatch_detected: for exterior shots, true if one or more panels show a clear color or texture mismatch vs. adjacent panels (accident-repair sign)
- accident_repair_signs: array of observations that suggest prior collision repair (panel_gaps, non_factory_welds, replaced_fender_liner, paint_overspray, color_mismatch)
- cabin_concerns: for interior photos, array of observations (smoke_staining, stains, rips, pet_damage, heavy_wear, aftermarket_additions)
- inspector_note: 1–2 sentences telling the dealer's inspector what to look at closely. Plain English. Include it ONLY when you see something an inspector should verify in person.

DO NOT flag normal age-appropriate wear (light interior scuffs on an older vehicle, average tire wear, factory-original paint variation) as damage.

Then provide overall judgement:
- overall_severity: none / minor / moderate / severe
- confidence_score: 0-100 — lower if photo is dark, blurry, partial, or off-angle
- suggested_condition: maps to the platform's 4-tier scale used by the offer engine —
    excellent  = no visible damage, looks new (top 3% of cars KBB values)
    very_good  = minor cosmetic only, no functional issues (top 28%)
    good       = moderate cosmetic, repairable, no major mechanical signals (top 50%)
    fair       = severe cosmetic OR visible mechanical signs (rust, panels, fluid, smoke residue)`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Score this "${photo_category}" photo. ${focusLine} Be conservative — only flag what is clearly visible. Use the 4-tier scale (excellent / very_good / good / fair) for suggested_condition.`,
              },
              {
                type: "image_url",
                image_url: { url: signedData.signedUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_damage",
              description: "Report the damage assessment results for the vehicle photo.",
              parameters: {
                type: "object",
                properties: {
                  damage_detected: { type: "boolean", description: "Whether any damage was found" },
                  damage_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["dent", "scratch", "rust", "paint_chip", "crack", "misaligned_panel", "missing_part", "stain", "tear", "wear", "other"] },
                        location: { type: "string" },
                        severity: { type: "string", enum: ["minor", "moderate", "severe"] },
                        description: { type: "string" },
                      },
                      required: ["type", "location", "severity", "description"],
                    },
                  },
                  overall_severity: { type: "string", enum: ["none", "minor", "moderate", "severe"] },
                  confidence_score: { type: "number", minimum: 0, maximum: 100 },
                  suggested_condition: { type: "string", enum: ["excellent", "very_good", "good", "fair"] },
                  // Category-specific verification fields. All optional —
                  // the AI should leave them null / empty when the photo
                  // doesn't show the relevant feature.
                  mileage_reading: { type: ["integer", "null"], description: "Odometer reading from a dashboard photo, null otherwise." },
                  warning_lights: {
                    type: "array",
                    items: { type: "string", enum: ["check_engine", "airbag", "abs", "tpms", "oil_pressure", "battery", "service_engine", "traction_control", "other"] },
                  },
                  tire_tread_32nds: { type: ["number", "null"], description: "Remaining tread in 32nds of an inch (tire photos)." },
                  tire_issues: {
                    type: "array",
                    items: { type: "string", enum: ["sidewall_bulge", "sidewall_crack", "curb_rash_on_wheel", "uneven_wear", "looks_new", "looks_worn", "other"] },
                  },
                  paint_mismatch_detected: { type: "boolean" },
                  accident_repair_signs: {
                    type: "array",
                    items: { type: "string", enum: ["panel_gaps", "non_factory_welds", "replaced_fender_liner", "paint_overspray", "color_mismatch"] },
                  },
                  cabin_concerns: {
                    type: "array",
                    items: { type: "string", enum: ["smoke_staining", "stains", "rips", "pet_damage", "heavy_wear", "aftermarket_additions"] },
                  },
                  inspector_note: { type: ["string", "null"], description: "Short plain-English note for the human inspector. Null when there's nothing notable." },
                },
                required: ["damage_detected", "damage_items", "overall_severity", "confidence_score", "suggested_condition"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_damage" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Store the damage report. Verification fields go into verification_findings
    // (jsonb) so we don't need a new column per signal and the inspector UI
    // can pick out whatever the AI saw.
    const verificationFindings = {
      mileage_reading: result.mileage_reading ?? null,
      warning_lights: result.warning_lights ?? [],
      tire_tread_32nds: result.tire_tread_32nds ?? null,
      tire_issues: result.tire_issues ?? [],
      paint_mismatch_detected: result.paint_mismatch_detected ?? false,
      accident_repair_signs: result.accident_repair_signs ?? [],
      cabin_concerns: result.cabin_concerns ?? [],
      inspector_note: result.inspector_note ?? null,
    };

    const { error: insertErr } = await supabase.from("damage_reports").insert({
      submission_id,
      photo_category,
      photo_path,
      ai_model: "gemini-2.5-flash",
      damage_detected: result.damage_detected,
      damage_items: result.damage_items,
      overall_severity: result.overall_severity,
      confidence_score: result.confidence_score,
      suggested_condition: result.suggested_condition,
      verification_findings: verificationFindings,
      raw_response: aiData,
    });

    if (insertErr) {
      console.error("Insert error:", insertErr);
    }

    // After analyzing all photos, update the submission's AI condition summary
    // Fetch all reports for this submission
    const { data: allReports } = await supabase
      .from("damage_reports")
      .select("*")
      .eq("submission_id", submission_id);

    if (allReports && allReports.length > 0) {
      const totalDamageItems = allReports.reduce(
        (acc: DamageItem[], r: any) => [...acc, ...(r.damage_items as DamageItem[])],
        []
      );
      const severeCount = totalDamageItems.filter((d) => d.severity === "severe").length;
      const moderateCount = totalDamageItems.filter((d) => d.severity === "moderate").length;
      const minorCount = totalDamageItems.filter((d) => d.severity === "minor").length;

      let aiCondition = "excellent";
      if (severeCount >= 2) aiCondition = "poor";
      else if (severeCount >= 1 || moderateCount >= 3) aiCondition = "fair";
      else if (moderateCount >= 1 || minorCount >= 3) aiCondition = "good";

      const summaryParts: string[] = [];
      if (severeCount > 0) summaryParts.push(`${severeCount} severe`);
      if (moderateCount > 0) summaryParts.push(`${moderateCount} moderate`);
      if (minorCount > 0) summaryParts.push(`${minorCount} minor`);

      // Pull the headline verification findings across every photo so the
      // inspector sees "CEL + mileage 87,432 + paint mismatch detected"
      // at a glance on the customer file.
      const flagSet = new Set<string>();
      let detectedMileage: number | null = null;
      let minTread: number | null = null;
      for (const r of allReports) {
        const vf: any = (r as any).verification_findings || {};
        if (Array.isArray(vf.warning_lights)) {
          for (const w of vf.warning_lights) flagSet.add(`CEL:${w}`);
        }
        if (vf.paint_mismatch_detected) flagSet.add("paint_mismatch");
        if (Array.isArray(vf.accident_repair_signs) && vf.accident_repair_signs.length > 0) {
          flagSet.add("accident_repair_signs");
        }
        if (typeof vf.mileage_reading === "number" && vf.mileage_reading > 0) {
          detectedMileage = vf.mileage_reading;
        }
        if (typeof vf.tire_tread_32nds === "number") {
          minTread = minTread === null ? vf.tire_tread_32nds : Math.min(minTread, vf.tire_tread_32nds);
        }
      }

      const flagParts: string[] = [];
      if (flagSet.has("paint_mismatch")) flagParts.push("paint mismatch");
      if (flagSet.has("accident_repair_signs")) flagParts.push("accident-repair signs");
      const cels = [...flagSet].filter((f) => f.startsWith("CEL:")).map((f) => f.slice(4));
      if (cels.length > 0) flagParts.push(`warning lights (${cels.join(", ")})`);
      if (minTread !== null && minTread <= 4) flagParts.push(`low tire tread (~${minTread}/32)`);

      const issueCopy = summaryParts.length > 0
        ? `AI detected ${totalDamageItems.length} issue${totalDamageItems.length !== 1 ? "s" : ""}: ${summaryParts.join(", ")}`
        : "AI: No damage detected";
      const flagCopy = flagParts.length > 0 ? ` · Flags: ${flagParts.join(" · ")}` : "";
      const summary = issueCopy + flagCopy;

      const updatePayload: Record<string, any> = {
        ai_condition_score: aiCondition,
        ai_damage_summary: summary,
      };
      // Verify customer-entered mileage against what the AI read off the
      // dashboard. We don't overwrite the mileage — we just record what
      // the AI saw so the inspector can eyeball the mismatch.
      if (detectedMileage !== null) {
        updatePayload.ai_detected_mileage = detectedMileage;
      }

      await supabase
        .from("submissions")
        .update(updatePayload)
        .eq("id", submission_id);
    }

    return new Response(JSON.stringify({
      success: true,
      damage_detected: result.damage_detected,
      damage_items: result.damage_items,
      overall_severity: result.overall_severity,
      confidence_score: result.confidence_score,
      suggested_condition: result.suggested_condition,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-vehicle-damage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// @jwt-required — admin/cron only; default verify_jwt=true is correct.
// Admin-initiated staff invite. Sends a Supabase Auth invite email
// (rendered via auth-email-hook) and pre-assigns the requested role +
// location so the invitee skips the pending-approval step.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveCaller } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ROLES = new Set([
  "sales_bdc",
  "used_car_manager",
  "new_car_manager",
  "gsm_gm",
  "admin",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await resolveCaller(req, SUPABASE_URL, ANON_KEY, SERVICE_KEY);
    if (caller.kind !== "platform_admin" && caller.kind !== "tenant_staff") {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller has admin role (not just any staff)
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role, dealership_id, location_id")
      .eq("user_id", caller.userId);
    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) return json({ error: "Admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");
    const locationId: string | null = body.location_id && body.location_id !== "all" ? body.location_id : null;
    const displayName: string | null = body.display_name?.trim() || null;
    const redirectOrigin = String(body.redirect_origin || "").replace(/\/$/, "");

    if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
    if (!ALLOWED_ROLES.has(role)) return json({ error: "Invalid role" }, 400);

    const dealershipId =
      caller.kind === "tenant_staff"
        ? caller.dealershipId
        : (callerRoles?.find((r) => r.dealership_id && r.dealership_id !== "default")?.dealership_id ?? "default");

    // Check for existing user via profiles
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    let userId = existingProfile?.user_id as string | undefined;
    let invitedNew = false;

    if (!userId) {
      const redirectTo = redirectOrigin ? `${redirectOrigin}/reset-password` : undefined;
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          invited_role: role,
          invited_location_id: locationId,
          invited_dealership_id: dealershipId,
          display_name: displayName,
        },
      });
      if (inviteErr || !invited?.user) {
        console.error("inviteUserByEmail failed:", inviteErr);
        return json({ error: "Failed to send invite — contact support." }, 400);
      }
      userId = invited.user.id;
      invitedNew = true;
    } else {
      // Existing user — send a real magic link. admin.generateLink only
      // returns a URL; it does not deliver an email.
      const redirectTo = redirectOrigin ? `${redirectOrigin}/reset-password` : undefined;
      const { error: linkErr } = await authClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (linkErr) {
        console.error("signInWithOtp failed:", linkErr);
        return json({ error: "Failed to send magic link — contact support." }, 400);
      }
    }

    // Pre-assign role (idempotent on (user_id, role) unique)
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({
        user_id: userId,
        role,
        dealership_id: dealershipId,
        location_id: role === "admin" ? null : locationId,
      });
    if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) {
      console.error("role assignment failed:", roleErr);
      return json({ error: "Invite sent but role assignment failed — contact support." }, 207);
    }

    // Clear any pending request for this email since they're now approved
    await admin.from("pending_admin_requests").delete().eq("email", email);

    if (displayName) {
      await admin.from("profiles").update({ display_name: displayName }).eq("user_id", userId);
    }

    return json({
      ok: true,
      user_id: userId,
      invited_new: invitedNew,
      message: invitedNew
        ? `Invite email sent to ${email}.`
        : `Magic-link email sent to ${email} (account already existed).`,
    });
  } catch (e) {
    console.error("invite-staff error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

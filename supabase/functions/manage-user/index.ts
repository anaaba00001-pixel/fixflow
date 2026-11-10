import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const allowedTargets: Record<string, string[]> = {
  PLATFORM_ADMIN: ["PLATFORM_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_MANAGER", "SUPERVISOR", "TECHNICIAN", "INVENTORY_MANAGER", "REGISTERED_REPORTER"],
  ORGANIZATION_ADMIN: ["BRANCH_MANAGER", "SUPERVISOR", "TECHNICIAN", "INVENTORY_MANAGER", "REGISTERED_REPORTER"],
  BRANCH_MANAGER: ["TECHNICIAN", "REGISTERED_REPORTER"],
  SUPERVISOR: ["TECHNICIAN", "REGISTERED_REPORTER"],
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const clean = (value: unknown) => String(value ?? "").trim();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "METHOD_NOT_ALLOWED" }, 405);

  let createdAuthId: string | null = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization") || "";
    if (!url || !anonKey || !serviceKey) return respond({ error: "SERVICE_NOT_CONFIGURED" }, 500);
    if (!authorization.startsWith("Bearer ")) return respond({ error: "UNAUTHENTICATED" }, 401);

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData } = await authClient.auth.getUser();
    if (!authData.user) return respond({ error: "UNAUTHENTICATED" }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: actor } = await admin.from("profiles").select("id,organization_id,role,is_active")
      .eq("id", authData.user.id).maybeSingle();
    if (!actor?.is_active || !allowedTargets[actor.role]) return respond({ error: "FORBIDDEN" }, 403);

    const body = await request.json();
    if (clean(body.action).toLowerCase() !== "create") return respond({ error: "INVALID_ACTION" }, 400);
    const input = body.user || {};
    const email = clean(input.email).toLowerCase();
    const fullName = clean(input.fullName ?? input.full_name);
    const role = clean(input.role).toUpperCase();
    const organizationId = role === "PLATFORM_ADMIN" ? null : clean(input.organizationId ?? input.organization_id);
    const locationIds = [...new Set((input.locationIds ?? input.location_ids ?? []).map(String).filter(Boolean))];
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return respond({ error: "INVALID_EMAIL" }, 400);
    if (fullName.length < 2) return respond({ error: "INVALID_FULL_NAME" }, 400);
    if (!allowedTargets[actor.role].includes(role)) return respond({ error: "TARGET_ROLE_FORBIDDEN" }, 403);
    if (actor.role !== "PLATFORM_ADMIN" && organizationId !== actor.organization_id) return respond({ error: "ORGANIZATION_FORBIDDEN" }, 403);
    if (role !== "PLATFORM_ADMIN" && !organizationId) return respond({ error: "ORGANIZATION_REQUIRED" }, 400);

    if (locationIds.length) {
      const { data: locations } = await admin.from("locations").select("id").eq("organization_id", organizationId).in("id", locationIds);
      if ((locations || []).length !== locationIds.length) return respond({ error: "INVALID_LOCATIONS" }, 400);
      if (["BRANCH_MANAGER", "SUPERVISOR"].includes(actor.role)) {
        const { data: actorLocations } = await admin.from("user_locations").select("location_id").eq("user_id", actor.id).in("location_id", locationIds);
        if ((actorLocations || []).length !== locationIds.length) return respond({ error: "LOCATION_FORBIDDEN" }, 403);
      }
    }

    const redirectTo = Deno.env.get("PUBLIC_SITE_URL") || undefined;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName, organization_id: organizationId, role },
    });
    if (inviteError || !invited.user) throw inviteError || new Error("INVITE_FAILED");
    createdAuthId = invited.user.id;

    const { data: profile, error: profileError } = await admin.from("profiles").insert({
      id: createdAuthId,
      organization_id: organizationId,
      full_name: fullName,
      email,
      phone: clean(input.phone) || null,
      role,
      specialization: role === "TECHNICIAN" ? clean(input.specialization) || null : null,
      availability_status: role === "TECHNICIAN" ? clean((input.availabilityStatus ?? input.availability_status) || "AVAILABLE").toUpperCase() : "AVAILABLE",
      is_active: input.isActive ?? input.is_active ?? true,
    }).select("*").single();
    if (profileError || !profile) throw profileError || new Error("PROFILE_CREATE_FAILED");

    if (locationIds.length) {
      const { error: locationError } = await admin.from("user_locations").insert(locationIds.map((locationId) => ({ user_id: profile.id, location_id: locationId, organization_id: organizationId })));
      if (locationError) throw locationError;
    }
    return respond({ success: true, user: profile }, 201);
  } catch (error) {
    if (createdAuthId) {
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await createClient(url, key).auth.admin.deleteUser(createdAuthId);
    }
    return respond({ error: error instanceof Error ? error.message : "UNEXPECTED_ERROR" }, 400);
  }
});

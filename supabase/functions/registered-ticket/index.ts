import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const priorities = new Set(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const text = (value: unknown) => String(value ?? "").trim();
const randomToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization") || "";
    if (!url || !anonKey || !serviceKey) return reply({ error: "SERVICE_NOT_CONFIGURED" }, 500);
    if (!authorization.startsWith("Bearer ")) return reply({ error: "UNAUTHENTICATED" }, 401);

    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return reply({ error: "UNAUTHENTICATED" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profile } = await admin.from("profiles")
      .select("id,organization_id,full_name,email,phone,role,is_active")
      .eq("id", authData.user.id).maybeSingle();
    if (!profile?.is_active || !profile.organization_id) return reply({ error: "FORBIDDEN" }, 403);

    const body = await request.json();
    if (text(body.action || "create").toLowerCase() !== "create") return reply({ error: "INVALID_ACTION" }, 400);
    const title = text(body.title);
    const description = text(body.description);
    const priority = text(body.priority || "MEDIUM").toUpperCase();
    if (title.length < 3 || title.length > 200) return reply({ error: "INVALID_TITLE" }, 400);
    if (description.length < 10 || description.length > 3000) return reply({ error: "INVALID_DESCRIPTION" }, 400);
    if (!priorities.has(priority)) return reply({ error: "INVALID_PRIORITY" }, 400);

    const assetId = text(body.assetId ?? body.asset_id) || null;
    let locationId = text(body.locationId ?? body.location_id) || null;
    let defaultCategoryId: string | null = null;
    if (assetId) {
      const { data: asset } = await admin.from("assets").select("id,organization_id,location_id,category_id,is_active")
        .eq("id", assetId).eq("organization_id", profile.organization_id).maybeSingle();
      if (!asset?.is_active) return reply({ error: "INVALID_ASSET" }, 400);
      locationId = asset.location_id;
      defaultCategoryId = asset.category_id;
    }
    if (!locationId) return reply({ error: "LOCATION_REQUIRED" }, 400);
    const { data: location } = await admin.from("locations").select("id")
      .eq("id", locationId).eq("organization_id", profile.organization_id).eq("is_active", true).maybeSingle();
    if (!location) return reply({ error: "INVALID_LOCATION" }, 400);

    let categoryId = text(body.categoryId ?? body.category_id) || defaultCategoryId;
    if (categoryId) {
      const { data: category } = await admin.from("categories").select("id").eq("id", categoryId)
        .eq("organization_id", profile.organization_id).eq("is_active", true).maybeSingle();
      if (!category) return reply({ error: "INVALID_CATEGORY" }, 400);
      categoryId = category.id;
    }

    const trackingToken = randomToken();
    const ticketNumber = `FF-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const now = new Date().toISOString();
    const { data: ticket, error } = await admin.from("tickets").insert({
      organization_id: profile.organization_id,
      ticket_number: ticketNumber,
      tracking_token_hash: await sha256(trackingToken),
      asset_id: assetId,
      location_id: locationId,
      category_id: categoryId || null,
      title,
      description,
      priority,
      status: "NEW",
      reporter_user_id: profile.id,
      reporter_name: profile.full_name,
      reporter_email: profile.email,
      reporter_phone: profile.phone,
      reporter_contact: profile.phone || profile.email,
      created_at: now,
      updated_at: now,
    }).select("*").single();
    if (error || !ticket) throw error || new Error("CREATE_FAILED");

    await admin.from("ticket_history").insert({
      organization_id: profile.organization_id,
      ticket_id: ticket.id,
      actor_id: profile.id,
      from_status: null,
      to_status: "NEW",
      reason: "Created by registered reporter",
    });
    return reply({ success: true, data: { ...ticket, trackingToken } }, 201);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "UNEXPECTED_ERROR" }, 500);
  }
});

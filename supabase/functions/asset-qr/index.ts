import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const keyFor = async (secret: string) => crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)), "AES-GCM", false, ["encrypt", "decrypt"]);
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((v) => v.toString(16).padStart(2, "0")).join("");
const newToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionSecret = Deno.env.get("QR_TOKEN_ENCRYPTION_KEY");
    const authorization = request.headers.get("Authorization") || "";
    if (!url || !anonKey || !serviceKey || !encryptionSecret) return response({ error: "SERVICE_NOT_CONFIGURED" }, 500);
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: authData } = await authClient.auth.getUser();
    if (!authData.user) return response({ error: "UNAUTHENTICATED" }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: actor } = await admin.from("profiles").select("id,organization_id,role,is_active").eq("id", authData.user.id).maybeSingle();
    if (!actor?.is_active || !["PLATFORM_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_MANAGER", "SUPERVISOR"].includes(actor.role)) return response({ error: "FORBIDDEN" }, 403);

    const body = await request.json();
    const action = String(body.action || "reveal").toLowerCase();
    const assetId = String(body.assetId ?? body.asset_id ?? "").trim();
    const { data: asset } = await admin.from("assets").select("id,organization_id,location_id").eq("id", assetId).maybeSingle();
    if (!asset) return response({ error: "ASSET_NOT_FOUND" }, 404);
    if (actor.role !== "PLATFORM_ADMIN" && asset.organization_id !== actor.organization_id) return response({ error: "FORBIDDEN" }, 403);
    if (["BRANCH_MANAGER", "SUPERVISOR"].includes(actor.role)) {
      const { data: permitted } = await admin.from("user_locations").select("location_id").eq("user_id", actor.id).eq("location_id", asset.location_id).maybeSingle();
      if (!permitted) return response({ error: "FORBIDDEN" }, 403);
    }

    const key = await keyFor(encryptionSecret);
    if (action === "reveal") {
      const { data: secret } = await admin.from("asset_qr_secrets").select("ciphertext,iv").eq("asset_id", asset.id).maybeSingle();
      if (!secret) return response({ error: "QR_TOKEN_NOT_RECOVERABLE", requiresRotation: true }, 409);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(secret.iv) }, key, base64ToBytes(secret.ciphertext));
      return response({ qrToken: new TextDecoder().decode(plain) });
    }
    if (!["rotate", "store"].includes(action)) return response({ error: "INVALID_ACTION" }, 400);
    const token = action === "store" ? String(body.qrToken ?? body.qr_token ?? "").trim() : newToken();
    if (token.length < 32) return response({ error: "INVALID_QR_TOKEN" }, 400);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
    const { error } = await admin.rpc("store_asset_qr_secret", {
      p_asset_id: asset.id,
      p_token_hash: await hash(token),
      p_ciphertext: bytesToBase64(new Uint8Array(encrypted)),
      p_iv: bytesToBase64(iv),
    });
    if (error) throw error;
    return response({ qrToken: token });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "UNEXPECTED_ERROR" }, 400);
  }
});

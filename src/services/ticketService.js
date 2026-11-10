import { requireSupabase } from "../lib/supabase";
import { assertTransition } from "../utils/ticketStatus";
import { validateImage, validateTicketInput } from "../utils/validation";

const TICKET_SELECT = "*, locations(id,name,address), assets(id,name,asset_number,serial_number), categories(id,name), profiles:profiles!tickets_assigned_technician_id_fkey(id,full_name,email,phone), reporter_profile:profiles!tickets_reporter_user_id_fkey(id,full_name,email,phone), ticket_history(*), ticket_attachments(*)";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listTickets(filters = {}) {
  let query = requireSupabase().from("tickets").select(TICKET_SELECT).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.technicianId) query = query.eq("assigned_technician_id", filters.technicianId);
  if (filters.reporterUserId) query = query.eq("reporter_user_id", filters.reporterUserId);
  if (filters.overdueOnly) query = query.eq("is_overdue", true);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.search) query = query.or(`ticket_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  return unwrap(await query);
}

export async function getTicket(id) {
  return unwrap(await requireSupabase().from("tickets").select(TICKET_SELECT).eq("id", id).single());
}

export async function createPublicTicket(payload) {
  const action = String(payload?.action || "create").trim().toLowerCase();
  const body = { ...payload, action };

  if (action === "create") {
    const validation = validateTicketInput({
      assetId: body.assetId ?? body.asset_id,
      description: body.description,
      priority: body.priority,
    });
    if (!validation.valid) throw new Error(Object.values(validation.errors)[0]);
  } else if (["track", "confirm_resolution", "reopen", "rate"].includes(action)) {
    if (!(body.trackingToken ?? body.tracking_token)) {
      throw new Error("TRACKING_TOKEN_REQUIRED");
    }
  } else if (action === "resolve_asset") {
    if (!(body.qrToken ?? body.qr_token)) throw new Error("INVALID_QR");
  } else {
    throw new Error(`UNSUPPORTED_PUBLIC_TICKET_ACTION:${action}`);
  }

  return unwrap(await requireSupabase().functions.invoke("public-ticket", { body }));
}

export async function createTicket(payload) {
  const validation = validateTicketInput({
    assetId: payload.assetId ?? payload.asset_id,
    description: payload.description,
    priority: payload.priority,
  });
  // Registered reporters may create a general ticket without an asset.
  if (validation.errors.assetId) delete validation.errors.assetId;
  if (Object.keys(validation.errors).length) {
    throw new Error(Object.values(validation.errors)[0]);
  }
  const result = unwrap(await requireSupabase().functions.invoke("registered-ticket", {
    body: { ...payload, action: "create" },
  }));
  return result?.data || result;
}

export async function assignTechnician(ticketId, technicianId, note = null) {
  return unwrap(await requireSupabase().functions.invoke("assign-technician", { body: { ticketId, technicianId, note } }));
}

export async function changeStatus(ticketOrId, nextStatus, reason = null) {
  const ticket = typeof ticketOrId === "object" ? ticketOrId : await getTicket(ticketOrId);
  assertTransition(ticket.status, nextStatus);
  return unwrap(await requireSupabase().rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: nextStatus, p_reason: reason }));
}

export async function approveTicketResolution(ticketId, note = null) {
  return unwrap(await requireSupabase().rpc("approve_ticket_resolution", {
    p_ticket_id: ticketId,
    p_note: note,
  }));
}

export async function uploadTicketAttachment(ticketId, file, type = "REPORT", organizationId) {
  const validation = validateImage(file);
  if (!validation.valid) throw new Error(validation.error);
  const extension = file.name?.split(".").pop()?.toLowerCase() || "webp";
  const path = `${organizationId}/${ticketId}/${type.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
  const client = requireSupabase();
  const upload = await client.storage.from("ticket-attachments").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;
  const { data: authData } = await client.auth.getUser();
  const uploadedBy = authData?.user?.id;
  if (!uploadedBy) {
    await client.storage.from("ticket-attachments").remove([path]);
    throw new Error("UNAUTHENTICATED");
  }
  const attachment = await client.from("ticket_attachments").insert({ organization_id: organizationId, ticket_id: ticketId, storage_path: path, type, mime_type: file.type, size_bytes: file.size, uploaded_by: uploadedBy }).select().single();
  if (attachment.error) {
    await client.storage.from("ticket-attachments").remove([path]);
    throw attachment.error;
  }
  return attachment.data;
}

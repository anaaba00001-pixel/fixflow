import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (!["GET", "POST"].includes(request.method)) {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  const configuredSecret = Deno.env.get("CRON_SECRET");
  const suppliedSecret = request.headers.get("x-cron-secret");
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return json({ success: false, message: "Unauthorized." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ success: false, message: "Service not configured." }, 500);

  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const now = new Date().toISOString();
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select("id, organization_id, status, is_overdue")
      .lt("due_at", now)
      .eq("is_overdue", false)
      .not("status", "in", "(CLOSED,CANCELLED)");

    if (error) throw error;
    if (!tickets?.length) return json({ success: true, data: { updated: 0 } });

    const ids = tickets.map((ticket) => ticket.id);
    const { error: updateError } = await supabase.from("tickets").update({ is_overdue: true }).in("id", ids);
    if (updateError) throw updateError;

    const history = tickets.map((ticket) => ({
      organization_id: ticket.organization_id,
      ticket_id: ticket.id,
      actor_id: null,
      from_status: ticket.status,
      to_status: ticket.status,
      reason: "تجاوز الطلب وقت الاستجابة المستهدف.",
    }));
    await supabase.from("ticket_history").insert(history);

    const organizationIds = [...new Set(tickets.map((ticket) => ticket.organization_id))];
    const { data: managers } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .in("organization_id", organizationIds)
      .in("role", ["ORGANIZATION_ADMIN", "SUPERVISOR"])
      .eq("is_active", true);

    const notifications = (managers ?? []).flatMap((manager) =>
      tickets
        .filter((ticket) => ticket.organization_id === manager.organization_id)
        .map((ticket) => ({
          organization_id: ticket.organization_id,
          user_id: manager.id,
          ticket_id: ticket.id,
          channel: "IN_APP",
          event_type: "TICKET_OVERDUE",
          status: "SENT",
          attempts: 0,
          sent_at: now,
        }))
    );
    if (notifications.length) await supabase.from("notifications").insert(notifications);

    return json({ success: true, data: { updated: tickets.length } });
  } catch (error) {
    console.error("check-overdue-tickets failed", error instanceof Error ? error.message : "unknown");
    return json({ success: false, message: "تعذر فحص الطلبات المتأخرة." }, 500);
  }
});

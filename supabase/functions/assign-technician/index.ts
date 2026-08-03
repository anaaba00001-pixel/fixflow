import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MANAGER_ROLES = [
  "PLATFORM_ADMIN",
  "ORGANIZATION_ADMIN",
  "SUPERVISOR",
];

const CLOSED_STATUSES = [
  "CLOSED",
  "CANCELLED",
];

type AssignTechnicianRequest = {
  ticketId?: string;
  ticket_id?: string;
  technicianId?: string;
  technician_id?: string;
  note?: string;
};

function createResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.trim().split(/\s+/);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        "حدث خطأ غير متوقع.",
    );
  }

  return "حدث خطأ غير متوقع.";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return createResponse(
      {
        success: false,
        error: "هذه الخدمة تقبل طلبات POST فقط.",
      },
      405,
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return createResponse(
        {
          success: false,
          error:
            "إعدادات Supabase غير مكتملة داخل Edge Function.",
        },
        500,
      );
    }

    const token = getBearerToken(request);

    if (!token) {
      return createResponse(
        {
          success: false,
          error:
            "يجب تسجيل الدخول لتنفيذ عملية التعيين.",
        },
        401,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return createResponse(
        {
          success: false,
          error:
            "جلسة تسجيل الدخول غير صالحة أو منتهية.",
        },
        401,
      );
    }

    let requestBody: AssignTechnicianRequest;

    try {
      requestBody = await request.json();
    } catch {
      return createResponse(
        {
          success: false,
          error:
            "بيانات الطلب المرسلة غير صالحة.",
        },
        400,
      );
    }

    const ticketId =
      cleanString(requestBody.ticketId) ||
      cleanString(requestBody.ticket_id);

    const technicianId =
      cleanString(requestBody.technicianId) ||
      cleanString(requestBody.technician_id);

    const note = cleanString(requestBody.note);

    if (!ticketId) {
      return createResponse(
        {
          success: false,
          error: "معرّف طلب الصيانة مطلوب.",
        },
        400,
      );
    }

    if (!technicianId) {
      return createResponse(
        {
          success: false,
          error: "معرّف فني الصيانة مطلوب.",
        },
        400,
      );
    }

    const {
      data: actorProfile,
      error: actorProfileError,
    } = await supabase
      .from("profiles")
      .select(
        `
          id,
          organization_id,
          full_name,
          email,
          role,
          is_active
        `,
      )
      .eq("id", authData.user.id)
      .single();

    if (
      actorProfileError ||
      !actorProfile ||
      actorProfile.is_active === false
    ) {
      return createResponse(
        {
          success: false,
          error:
            "حساب المستخدم غير موجود أو غير نشط.",
        },
        403,
      );
    }

    if (
      !ALLOWED_MANAGER_ROLES.includes(
        actorProfile.role,
      )
    ) {
      return createResponse(
        {
          success: false,
          error:
            "لا تملك صلاحية تعيين فني لطلب الصيانة.",
        },
        403,
      );
    }

    const {
      data: ticket,
      error: ticketError,
    } = await supabase
      .from("tickets")
      .select(
        `
          id,
          ticket_number,
          organization_id,
          location_id,
          title,
          status,
          priority,
          assigned_technician_id,
          created_at
        `,
      )
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return createResponse(
        {
          success: false,
          error:
            "لم يتم العثور على طلب الصيانة.",
        },
        404,
      );
    }

    if (
      actorProfile.role !== "PLATFORM_ADMIN" &&
      String(actorProfile.organization_id) !==
        String(ticket.organization_id)
    ) {
      return createResponse(
        {
          success: false,
          error:
            "لا يمكنك إدارة طلب تابع لمنشأة أخرى.",
        },
        403,
      );
    }

    if (
      CLOSED_STATUSES.includes(ticket.status)
    ) {
      return createResponse(
        {
          success: false,
          error:
            "لا يمكن تعيين فني لطلب مغلق أو ملغي.",
        },
        409,
      );
    }

    const {
      data: technician,
      error: technicianError,
    } = await supabase
      .from("profiles")
      .select(
        `
          id,
          organization_id,
          full_name,
          email,
          role,
          is_active
        `,
      )
      .eq("id", technicianId)
      .single();

    if (technicianError || !technician) {
      return createResponse(
        {
          success: false,
          error:
            "لم يتم العثور على فني الصيانة المحدد.",
        },
        404,
      );
    }

    if (technician.role !== "TECHNICIAN") {
      return createResponse(
        {
          success: false,
          error:
            "المستخدم المحدد ليس فني صيانة.",
        },
        400,
      );
    }

    if (technician.is_active === false) {
      return createResponse(
        {
          success: false,
          error:
            "لا يمكن تعيين فني حسابه غير نشط.",
        },
        409,
      );
    }

    if (
      String(technician.organization_id) !==
      String(ticket.organization_id)
    ) {
      return createResponse(
        {
          success: false,
          error:
            "فني الصيانة لا يتبع المنشأة الخاصة بالطلب.",
        },
        400,
      );
    }

    const previousTechnicianId =
      ticket.assigned_technician_id;

    const previousStatus = ticket.status;

    const nextStatus = [
      "NEW",
      "REOPENED",
    ].includes(previousStatus)
      ? "ASSIGNED"
      : previousStatus;

    const assignedAt =
      new Date().toISOString();

    const {
      data: updatedTicket,
      error: updateError,
    } = await supabase
      .from("tickets")
      .update({
        assigned_technician_id:
          technician.id,

        status: nextStatus,

        assigned_at: assignedAt,

        updated_at: assignedAt,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (updateError || !updatedTicket) {
      throw new Error(
        updateError?.message ||
          "تعذر تحديث طلب الصيانة.",
      );
    }

    const historyNote =
      note ||
      (
        previousTechnicianId
          ? `تمت إعادة تعيين الطلب إلى الفني ${technician.full_name}.`
          : `تم تعيين الطلب إلى الفني ${technician.full_name}.`
      );

    const {
      error: historyError,
    } = await supabase
      .from("ticket_history")
      .insert({
        organization_id:
          ticket.organization_id,
        ticket_id: ticket.id,
        actor_id: actorProfile.id,
        from_status: previousStatus,
        to_status: nextStatus,
        reason: historyNote,

        created_at: assignedAt,
      });

    if (historyError) {
      console.error(
        "Ticket history error:",
        historyError,
      );
    }

    const notificationTitle =
      "تم تعيين طلب صيانة جديد";

    const notificationMessage =
      `تم تعيين الطلب ${
        ticket.ticket_number || ticket.id
      } إليك: ${ticket.title}`;

    const {
      error: notificationError,
    } = await supabase
      .from("notifications")
      .insert([
        {
          organization_id:
            ticket.organization_id,

          user_id: technician.id,

          ticket_id: ticket.id,

          channel: "IN_APP",
          event_type: "TECHNICIAN_ASSIGNED",
          status: "SENT",
          attempts: 0,
          sent_at: assignedAt,

          created_at: assignedAt,
        },

        ...(technician.email
          ? [
              {
                organization_id:
                  ticket.organization_id,

                user_id: technician.id,

                ticket_id: ticket.id,

                channel: "EMAIL",
                event_type:
                  "TECHNICIAN_ASSIGNED",
                status: "PENDING",
                attempts: 0,

                created_at: assignedAt,
              },
            ]
          : []),
      ]);

    if (notificationError) {
      console.error(
        "Notification creation error:",
        notificationError,
      );
    }

    return createResponse({
      success: true,

      message:
        "تم تعيين فني الصيانة بنجاح.",

      ticket: updatedTicket,

      technician: {
        id: technician.id,
        full_name: technician.full_name,
        email: technician.email,
      },
    });
  } catch (error) {
    console.error(
      "assign-technician error:",
      error,
    );

    return createResponse(
      {
        success: false,
        error: normalizeError(error),
      },
      500,
    );
  }
});

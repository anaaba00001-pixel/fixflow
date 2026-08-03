import { requireSupabase } from "../lib/supabase";

const NOTIFICATION_SELECT = `
  id,
  organization_id,
  user_id,
  ticket_id,
  channel,
  event_type,
  status,
  attempts,
  last_error,
  sent_at,
  created_at,
  tickets (
    id,
    ticket_number,
    title,
    status,
    priority
  )
`;

const ALLOWED_CHANNELS = [
  "IN_APP",
  "EMAIL",
];

const ALLOWED_STATUSES = [
  "PENDING",
  "SENT",
  "FAILED",
  "CANCELLED",
];

const DEFAULT_PREFERENCES = {
  in_app_enabled: true,
  email_enabled: true,
};

function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  return normalizedValue || null;
}

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function firstRelation(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value;
}

function enhanceNotificationError(error) {
  const message = String(
    error?.message ||
      error?.details ||
      error?.hint ||
      ""
  ).toLowerCase();

  if (
    error?.code === "PGRST116" ||
    message.includes("no rows")
  ) {
    return new Error(
      "لم يتم العثور على الإشعار."
    );
  }

  if (
    error?.code === "23503" ||
    message.includes("foreign key")
  ) {
    return new Error(
      "المستخدم أو طلب الصيانة المرتبط بالإشعار غير صالح."
    );
  }

  if (
    error?.code === "42501" ||
    message.includes("permission") ||
    message.includes("row-level security")
  ) {
    return new Error(
      "لا تملكين صلاحية الوصول إلى هذا الإشعار."
    );
  }

  if (
    error?.status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return new Error(
      "تم تنفيذ طلبات كثيرة خلال وقت قصير. انتظري قليلًا ثم حاولي مرة أخرى."
    );
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("network")
  ) {
    return new Error(
      "تعذر الاتصال بالخادم. تحققي من اتصال الإنترنت."
    );
  }

  return error instanceof Error
    ? error
    : new Error(
        "حدث خطأ أثناء معالجة الإشعار."
      );
}

async function getCurrentUserId() {
  const { data, error } =
    await requireSupabase().auth.getUser();

  if (error) {
    throw enhanceNotificationError(error);
  }

  return data?.user?.id || null;
}

async function resolveUserId(userId) {
  if (userId) {
    return userId;
  }

  const currentUserId =
    await getCurrentUserId();

  if (!currentUserId) {
    throw new Error(
      "يجب تسجيل الدخول لعرض الإشعارات."
    );
  }

  return currentUserId;
}

function getReadStorageKey(userId) {
  return `fixflow-read-notifications-${userId}`;
}

function getPreferencesStorageKey(userId) {
  return `fixflow-notification-preferences-${userId}`;
}

function readStoredIds(userId) {
  if (
    typeof window === "undefined" ||
    !userId
  ) {
    return [];
  }

  try {
    const storedValue =
      window.localStorage.getItem(
        getReadStorageKey(userId)
      );

    if (!storedValue) {
      return [];
    }

    const parsedValue =
      JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue.map(String)
      : [];
  } catch {
    return [];
  }
}

function saveStoredIds(userId, ids) {
  if (
    typeof window === "undefined" ||
    !userId
  ) {
    return;
  }

  const uniqueIds = [
    ...new Set(ids.map(String)),
  ];

  window.localStorage.setItem(
    getReadStorageKey(userId),
    JSON.stringify(uniqueIds)
  );
}

function markIdAsReadLocally(
  userId,
  notificationId
) {
  const ids = readStoredIds(userId);

  if (
    !ids.includes(String(notificationId))
  ) {
    ids.push(String(notificationId));
  }

  saveStoredIds(userId, ids);
}

function markIdAsUnreadLocally(
  userId,
  notificationId
) {
  const ids = readStoredIds(userId).filter(
    (id) =>
      String(id) !==
      String(notificationId)
  );

  saveStoredIds(userId, ids);
}

function getNotificationTemplate(
  eventType,
  ticket
) {
  const ticketNumber =
    ticket?.ticket_number ||
    ticket?.id ||
    "";

  const ticketTitle =
    ticket?.title ||
    "طلب الصيانة";

  switch (eventType) {
    case "TICKET_CREATED":
      return {
        title: "طلب صيانة جديد",
        message: ticketNumber
          ? `تم إنشاء الطلب ${ticketNumber}: ${ticketTitle}`
          : "تم إنشاء طلب صيانة جديد.",
      };

    case "EMERGENCY_TICKET":
      return {
        title: "طلب صيانة طارئ",
        message: ticketNumber
          ? `يوجد طلب طارئ ${ticketNumber}: ${ticketTitle}`
          : "يوجد طلب صيانة طارئ.",
      };

    case "TECHNICIAN_ASSIGNED":
      return {
        title: "تم تعيين طلب صيانة",
        message: ticketNumber
          ? `تم تعيين الطلب ${ticketNumber}.`
          : "تم تعيين طلب صيانة جديد.",
      };

    case "TICKET_ACCEPTED":
      return {
        title: "تم قبول الطلب",
        message: ticketNumber
          ? `تم قبول طلب الصيانة ${ticketNumber}.`
          : "تم قبول طلب الصيانة.",
      };

    case "WORK_STARTED":
      return {
        title: "بدأ العمل على الطلب",
        message: ticketNumber
          ? `بدأ الفني العمل على الطلب ${ticketNumber}.`
          : "بدأ الفني العمل على طلب الصيانة.",
      };

    case "WAITING_PARTS":
      return {
        title: "بانتظار قطع الغيار",
        message: ticketNumber
          ? `الطلب ${ticketNumber} بانتظار قطع الغيار.`
          : "طلب الصيانة بانتظار قطع الغيار.",
      };

    case "WORK_RESUMED":
      return {
        title: "تم استئناف العمل",
        message: ticketNumber
          ? `تم استئناف العمل على الطلب ${ticketNumber}.`
          : "تم استئناف أعمال الصيانة.",
      };

    case "TICKET_OVERDUE":
      return {
        title: "طلب صيانة متأخر",
        message: ticketNumber
          ? `تجاوز الطلب ${ticketNumber} وقت الاستحقاق.`
          : "يوجد طلب صيانة متأخر.",
      };

    case "REPAIR_COMPLETED":
    case "APPROVAL_REQUIRED":
      return {
        title: "اكتملت أعمال الصيانة",
        message: ticketNumber
          ? `اكتملت أعمال الطلب ${ticketNumber} وهو بانتظار الاعتماد.`
          : "اكتملت أعمال الصيانة وهي بانتظار الاعتماد.",
      };

    case "TICKET_CLOSED":
      return {
        title: "تم إغلاق الطلب",
        message: ticketNumber
          ? `تم إغلاق الطلب ${ticketNumber}.`
          : "تم إغلاق طلب الصيانة.",
      };

    case "TICKET_REOPENED":
      return {
        title: "أُعيد فتح الطلب",
        message: ticketNumber
          ? `تمت إعادة فتح الطلب ${ticketNumber}.`
          : "تمت إعادة فتح طلب الصيانة.",
      };

    case "TICKET_CANCELLED":
      return {
        title: "تم إلغاء الطلب",
        message: ticketNumber
          ? `تم إلغاء الطلب ${ticketNumber}.`
          : "تم إلغاء طلب الصيانة.",
      };

    case "DAILY_REPORT_READY":
      return {
        title: "التقرير اليومي جاهز",
        message:
          "تم إنشاء التقرير اليومي لنشاط الصيانة.",
      };

    case "MONTHLY_REPORT_READY":
      return {
        title: "التقرير الشهري جاهز",
        message:
          "تم إنشاء التقرير الشهري لنشاط الصيانة.",
      };

    default:
      return {
        title: "إشعار من FixFlow",
        message: ticketNumber
          ? `يوجد تحديث على الطلب ${ticketNumber}.`
          : "يوجد تحديث جديد في النظام.",
      };
  }
}

function decorateNotification(
  notification,
  readIds = []
) {
  const ticket = firstRelation(
    notification.tickets
  );

  const template =
    getNotificationTemplate(
      notification.event_type,
      ticket
    );

  const isRead = readIds.includes(
    String(notification.id)
  );

  return {
    ...notification,

    ticket,

    type:
      notification.event_type,

    eventType:
      notification.event_type,

    title:
      template.title,

    message:
      template.message,

    is_read:
      isRead,

    isRead,

    read_at:
      isRead
        ? notification.created_at
        : null,

    retry_count:
      notification.attempts || 0,
  };
}

export async function listNotifications(
  filters = {}
) {
  const userId = await resolveUserId(
    filters.userId ||
      filters.user_id
  );

  const limit = Math.min(
    Math.max(
      Number(filters.limit) || 50,
      1
    ),
    200
  );

  let query = requireSupabase()
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  const organizationId =
    filters.organizationId ||
    filters.organization_id;

  const ticketId =
    filters.ticketId ||
    filters.ticket_id;

  const eventType = normalizeValue(
    filters.eventType ||
      filters.event_type ||
      filters.type
  );

  const channel = normalizeValue(
    filters.channel
  );

  const status = normalizeValue(
    filters.status
  );

  if (organizationId) {
    query = query.eq(
      "organization_id",
      organizationId
    );
  }

  if (ticketId) {
    query = query.eq(
      "ticket_id",
      ticketId
    );
  }

  if (eventType) {
    query = query.eq(
      "event_type",
      eventType
    );
  }

  if (channel) {
    query = query.eq(
      "channel",
      channel
    );
  }

  if (status) {
    query = query.eq(
      "status",
      status
    );
  }

  const { data, error } = await query;

  if (error) {
    throw enhanceNotificationError(error);
  }

  const readIds =
    readStoredIds(userId);

  let notifications = (data || []).map(
    (notification) =>
      decorateNotification(
        notification,
        readIds
      )
  );

  if (
    filters.unreadOnly === true ||
    filters.unread_only === true
  ) {
    notifications =
      notifications.filter(
        (notification) =>
          !notification.isRead
      );
  }

  if (
    filters.readOnly === true ||
    filters.read_only === true
  ) {
    notifications =
      notifications.filter(
        (notification) =>
          notification.isRead
      );
  }

  return notifications;
}

export async function getNotification(
  notificationId,
  userId = null
) {
  if (!notificationId) {
    throw new Error(
      "معرّف الإشعار مطلوب."
    );
  }

  const resolvedUserId =
    await resolveUserId(userId);

  const { data, error } =
    await requireSupabase()
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .eq("id", notificationId)
      .eq("user_id", resolvedUserId)
      .single();

  if (error) {
    throw enhanceNotificationError(error);
  }

  return decorateNotification(
    data,
    readStoredIds(resolvedUserId)
  );
}

export async function getUnreadCount(
  userId = null
) {
  const resolvedUserId =
    await resolveUserId(userId);

  const notifications =
    await listNotifications({
      userId: resolvedUserId,
      channel: "IN_APP",
      limit: 200,
    });

  return notifications.filter(
    (notification) =>
      !notification.isRead
  ).length;
}

export async function createNotification(
  formPayload = {}
) {
  const organizationId =
    formPayload.organizationId ||
    formPayload.organization_id;

  const userId =
    formPayload.userId ||
    formPayload.user_id ||
    null;

  const ticketId =
    formPayload.ticketId ||
    formPayload.ticket_id ||
    null;

  const channel = normalizeValue(
    formPayload.channel || "IN_APP"
  );

  const eventType = normalizeValue(
    formPayload.eventType ||
      formPayload.event_type ||
      formPayload.type
  );

  const status = normalizeValue(
    formPayload.status || "PENDING"
  );

  if (!organizationId) {
    throw new Error(
      "معرّف المنشأة مطلوب لإنشاء الإشعار."
    );
  }

  if (!eventType) {
    throw new Error(
      "نوع الإشعار مطلوب."
    );
  }

  if (
    !/^[A-Z0-9_]{2,80}$/.test(
      eventType
    )
  ) {
    throw new Error(
      "نوع الإشعار غير صحيح."
    );
  }

  if (
    !ALLOWED_CHANNELS.includes(
      channel
    )
  ) {
    throw new Error(
      "قناة الإشعار غير صحيحة."
    );
  }

  if (
    !ALLOWED_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      "حالة الإشعار غير صحيحة."
    );
  }

  if (
    channel === "IN_APP" &&
    !userId
  ) {
    throw new Error(
      "معرّف المستخدم مطلوب للإشعار الداخلي."
    );
  }

  const now =
    new Date().toISOString();

  const { data, error } =
    await requireSupabase()
      .from("notifications")
      .insert({
        organization_id:
          organizationId,

        user_id:
          userId,

        ticket_id:
          ticketId,

        channel,

        event_type:
          eventType,

        status,

        attempts:
          Number(
            formPayload.attempts || 0
          ),

        last_error:
          cleanString(
            formPayload.lastError ||
              formPayload.last_error
          ),

        sent_at:
          status === "SENT"
            ? formPayload.sentAt ||
              formPayload.sent_at ||
              now
            : null,
      })
      .select(NOTIFICATION_SELECT)
      .single();

  if (error) {
    throw enhanceNotificationError(error);
  }

  return decorateNotification(
    data,
    readStoredIds(userId)
  );
}

export async function sendNotification(
  payload = {}
) {
  const organizationId =
    payload.organizationId ||
    payload.organization_id;

  const eventType =
    payload.eventType ||
    payload.event_type ||
    payload.type;

  if (!organizationId) {
    throw new Error(
      "معرّف المنشأة مطلوب."
    );
  }

  if (!eventType) {
    throw new Error(
      "نوع الإشعار مطلوب."
    );
  }

  const { data, error } =
    await requireSupabase()
      .functions
      .invoke("send-notification", {
        body: {
          organizationId,

          userId:
            payload.userId ||
            payload.user_id ||
            null,

          ticketId:
            payload.ticketId ||
            payload.ticket_id ||
            null,

          recipientEmail:
            payload.recipientEmail ||
            payload.recipient_email ||
            null,

          eventType,

          channel:
            payload.channel ||
            "IN_APP",

          title:
            payload.title ||
            null,

          message:
            payload.message ||
            null,
        },
      });

  if (error) {
    throw enhanceNotificationError(error);
  }

  return data;
}

export async function markNotificationAsRead(
  notificationId,
  userId = null
) {
  if (!notificationId) {
    throw new Error(
      "معرّف الإشعار مطلوب."
    );
  }

  const resolvedUserId =
    await resolveUserId(userId);

  await getNotification(
    notificationId,
    resolvedUserId
  );

  markIdAsReadLocally(
    resolvedUserId,
    notificationId
  );

  return getNotification(
    notificationId,
    resolvedUserId
  );
}

export async function markNotificationAsUnread(
  notificationId,
  userId = null
) {
  if (!notificationId) {
    throw new Error(
      "معرّف الإشعار مطلوب."
    );
  }

  const resolvedUserId =
    await resolveUserId(userId);

  await getNotification(
    notificationId,
    resolvedUserId
  );

  markIdAsUnreadLocally(
    resolvedUserId,
    notificationId
  );

  return getNotification(
    notificationId,
    resolvedUserId
  );
}

export async function markAllNotificationsAsRead(
  userId = null
) {
  const resolvedUserId =
    await resolveUserId(userId);

  const notifications =
    await listNotifications({
      userId: resolvedUserId,
      channel: "IN_APP",
      limit: 200,
    });

  const ids = [
    ...readStoredIds(resolvedUserId),

    ...notifications.map(
      (notification) =>
        String(notification.id)
    ),
  ];

  saveStoredIds(
    resolvedUserId,
    ids
  );

  return notifications.map(
    (notification) => ({
      ...notification,
      is_read: true,
      isRead: true,
      read_at:
        notification.created_at,
    })
  );
}

export async function deleteNotification(
  notificationId,
  userId = null
) {
  if (!notificationId) {
    throw new Error(
      "معرّف الإشعار مطلوب."
    );
  }

  const resolvedUserId =
    await resolveUserId(userId);

  const { error } =
    await requireSupabase()
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", resolvedUserId);

  if (error) {
    throw enhanceNotificationError(error);
  }

  markIdAsUnreadLocally(
    resolvedUserId,
    notificationId
  );

  return true;
}

export async function deleteReadNotifications(
  userId = null
) {
  const resolvedUserId =
    await resolveUserId(userId);

  const readIds =
    readStoredIds(resolvedUserId);

  if (readIds.length === 0) {
    return true;
  }

  const { error } =
    await requireSupabase()
      .from("notifications")
      .delete()
      .eq("user_id", resolvedUserId)
      .in("id", readIds);

  if (error) {
    throw enhanceNotificationError(error);
  }

  saveStoredIds(
    resolvedUserId,
    []
  );

  return true;
}

export async function getNotificationPreferences(
  userId = null
) {
  const resolvedUserId =
    await resolveUserId(userId);

  if (typeof window === "undefined") {
    return {
      user_id: resolvedUserId,
      ...DEFAULT_PREFERENCES,
    };
  }

  try {
    const storedValue =
      window.localStorage.getItem(
        getPreferencesStorageKey(
          resolvedUserId
        )
      );

    if (!storedValue) {
      return {
        user_id: resolvedUserId,
        ...DEFAULT_PREFERENCES,
      };
    }

    return {
      user_id: resolvedUserId,
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(storedValue),
    };
  } catch {
    return {
      user_id: resolvedUserId,
      ...DEFAULT_PREFERENCES,
    };
  }
}

export async function updateNotificationPreferences(
  payload = {},
  userId = null
) {
  const resolvedUserId =
    await resolveUserId(
      userId ||
        payload.userId ||
        payload.user_id
    );

  const preferences = {
    user_id:
      resolvedUserId,

    in_app_enabled:
      payload.inAppEnabled ??
      payload.in_app_enabled ??
      true,

    email_enabled:
      payload.emailEnabled ??
      payload.email_enabled ??
      true,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      getPreferencesStorageKey(
        resolvedUserId
      ),
      JSON.stringify(preferences)
    );
  }

  return preferences;
}

export function subscribeToNotifications(
  userId,
  onNotification
) {
  if (!userId) {
    throw new Error(
      "معرّف المستخدم مطلوب للاشتراك في الإشعارات."
    );
  }

  if (
    typeof onNotification !== "function"
  ) {
    throw new Error(
      "يجب تمرير دالة لمعالجة الإشعارات الجديدة."
    );
  }

  const supabase =
    requireSupabase();

  const channel = supabase
    .channel(
      `notifications:${userId}`
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter:
          `user_id=eq.${userId}`,
      },
      (payload) => {
        const notification =
          decorateNotification(
            payload.new,
            readStoredIds(userId)
          );

        onNotification(notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export const getNotifications =
  listNotifications;

export const getUnreadNotificationsCount =
  getUnreadCount;

export const markAsRead =
  markNotificationAsRead;

export const markAsUnread =
  markNotificationAsUnread;

export const markAllAsRead =
  markAllNotificationsAsRead;

export const clearReadNotifications =
  deleteReadNotifications;
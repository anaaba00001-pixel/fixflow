import {
  useEffect,
  useMemo,
  useState,
} from "react";

import EmptyState from "../../components/common/EmptyState";
import AssignTechnicianModal from "../../components/tickets/AssignTechnicianModal";
import CloseTicketModal from "../../components/tickets/CloseTicketModal";
import TicketPriorityBadge from "../../components/tickets/TicketPriorityBadge";
import TicketStatusBadge from "../../components/tickets/TicketStatusBadge";
import TicketTimeline from "../../components/tickets/TicketTimeline";

import { useAuth } from "../../hooks/useAuth";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../../lib/supabase";

import { navigate } from "../../routes/AppRouter";

import {
  approveTicketResolution,
  assignTechnician,
  changeStatus,
  getTicket,
} from "../../services/ticketService";

import { formatDate } from "../../utils/formatDate";
import { PERMISSION } from "../../utils/permissions";
import { getPriorityLabel } from "../../utils/ticketPriority";
import { getStatusLabel } from "../../utils/ticketStatus";

/* ==================================================
   البيانات التجريبية
================================================== */

const DEMO_TECHNICIANS = [
  {
    id: "technician-1",
    full_name: "محمد العتيبي",
    specialization: "تكييف وتبريد",
    is_active: true,
    availability_status: "AVAILABLE",
    open_tickets_count: 3,
    location_ids: [
      "location-riyadh",
      "location-jeddah",
    ],
  },
  {
    id: "technician-2",
    full_name: "أحمد الشمري",
    specialization: "كهرباء",
    is_active: true,
    availability_status: "AVAILABLE",
    open_tickets_count: 2,
    location_ids: ["location-riyadh"],
  },
  {
    id: "technician-3",
    full_name: "سالم الحربي",
    specialization: "سباكة",
    is_active: true,
    availability_status: "BUSY",
    open_tickets_count: 5,
    location_ids: [
      "location-riyadh",
      "location-hail",
    ],
  },
];

const DEMO_TICKET = {
  id: "ticket-demo-details",
  ticket_number: "MT-2026-00125",

  title: "المكيف لا يبرد",

  description:
    "المكيف يعمل بصورة طبيعية، لكن الهواء الخارج غير بارد منذ صباح اليوم.",

  priority: "EMERGENCY",
  status: "PENDING_APPROVAL",

  organization_id: "demo-organization",
  location_id: "location-riyadh",
  category_id: "category-ac",
  asset_id: "asset-ac-1",

  assigned_technician_id:
    "technician-1",

  reporter_user_id: null,

  reporter_name: "سارة محمد",
  reporter_phone: "0500000000",
  reporter_email:
    "reporter@example.com",

  due_at:
    "2026-07-25T14:00:00+03:00",

  created_at:
    "2026-07-25T08:15:00+03:00",

  updated_at:
    "2026-07-25T15:40:00+03:00",

  started_at:
    "2026-07-25T10:20:00+03:00",

  completed_at:
    "2026-07-25T15:30:00+03:00",

  resolution_summary:
    "تم تنظيف المرشحات وفحص ضغط الغاز وتنظيف الوحدة الخارجية. تم اختبار الجهاز لمدة 30 دقيقة ويعمل الآن بصورة طبيعية.",

  locations: {
    id: "location-riyadh",
    name: "فرع الرياض",
  },

  assets: {
    id: "asset-ac-1",
    name: "مكيف غرفة الاجتماعات",
    asset_number: "AC-RYD-001",
    serial_number: "SN-AC-458921",
  },

  categories: {
    id: "category-ac",
    name: "تكييف وتبريد",
  },

  profiles: {
    id: "technician-1",
    full_name: "محمد العتيبي",
    specialization: "تكييف وتبريد",
  },

  reporter_profile: {
    id: "reporter-demo",
    full_name: "سارة محمد",
    email: "reporter@example.com",
    phone: "0500000000",
  },

  ticket_attachments: [
    {
      id: "attachment-before",
      attachment_type: "BEFORE",
      file_name: "before-repair.jpg",

      public_url:
        "https://placehold.co/600x400?text=Before+Repair",

      created_at:
        "2026-07-25T08:20:00+03:00",
    },
    {
      id: "attachment-after",
      attachment_type: "AFTER",
      file_name: "after-repair.jpg",

      public_url:
        "https://placehold.co/600x400?text=After+Repair",

      created_at:
        "2026-07-25T15:25:00+03:00",
    },
  ],

  ticket_comments: [
    {
      id: "comment-public-1",
      author_name: "محمد العتيبي",

      comment:
        "تم الانتهاء من الإصلاح ويمكن تجربة الجهاز.",

      is_internal: false,

      created_at:
        "2026-07-25T15:31:00+03:00",
    },
    {
      id: "comment-internal-1",
      author_name: "مشرف الصيانة",

      comment:
        "تمت مراجعة تقرير الفني داخليًا.",

      is_internal: true,

      created_at:
        "2026-07-25T15:35:00+03:00",
    },
  ],

  ticket_history: [
    {
      id: "history-5",
      action: "COMPLETED",
      actor_name: "محمد العتيبي",
      old_status: "IN_PROGRESS",
      new_status: "PENDING_APPROVAL",

      note:
        "اكتمل الإصلاح وتم إرسال الطلب للاعتماد.",

      is_internal: false,

      created_at:
        "2026-07-25T15:30:00+03:00",
    },
    {
      id: "history-4",
      action: "ATTACHMENT_ADDED",
      actor_name: "محمد العتيبي",

      note:
        "تمت إضافة صورة بعد الإصلاح.",

      is_internal: false,

      created_at:
        "2026-07-25T15:25:00+03:00",
    },
    {
      id: "history-3",
      action: "STARTED",
      actor_name: "محمد العتيبي",
      old_status: "ACCEPTED",
      new_status: "IN_PROGRESS",
      note: "تم بدء فحص المكيف.",
      is_internal: false,

      created_at:
        "2026-07-25T10:20:00+03:00",
    },
    {
      id: "history-2",
      action: "ASSIGNED",
      actor_name: "مشرف الصيانة",
      old_status: "NEW",
      new_status: "ASSIGNED",

      note:
        "تم تعيين الفني محمد العتيبي.",

      is_internal: false,

      created_at:
        "2026-07-25T09:00:00+03:00",
    },
    {
      id: "history-1",
      action: "CREATED",
      actor_name: "سارة محمد",
      new_status: "NEW",
      note: "تم إنشاء طلب الصيانة.",
      is_internal: false,

      created_at:
        "2026-07-25T08:15:00+03:00",
    },
  ],
};

/* ==================================================
   انتقالات الفني
================================================== */

const TECHNICIAN_ACTIONS = {
  ASSIGNED: [
    {
      nextStatus: "ACCEPTED",
      label: "قبول الطلب",
      className: "primary",
    },
  ],

  ACCEPTED: [
    {
      nextStatus: "IN_PROGRESS",
      label: "بدء العمل",
      className: "primary",
    },
  ],

  IN_PROGRESS: [
    {
      nextStatus: "WAITING_PARTS",
      label: "بانتظار قطعة",
      className: "secondary",
      requiresNote: true,
    },
    {
      nextStatus: "PENDING_APPROVAL",
      label: "إرسال للاعتماد",
      className: "primary",
      requiresNote: true,
    },
  ],

  WAITING_PARTS: [
    {
      nextStatus: "IN_PROGRESS",
      label: "استئناف العمل",
      className: "primary",
    },
  ],

  REOPENED: [
    {
      nextStatus: "IN_PROGRESS",
      label: "استئناف الصيانة",
      className: "primary",
    },
  ],
};

/* ==================================================
   دوال مساعدة
================================================== */

function resolveTicketId(
  explicitTicketId
) {
  if (explicitTicketId) {
    return explicitTicketId;
  }

  const searchParams =
    new URLSearchParams(
      window.location.search
    );

  const queryTicketId =
    searchParams.get("id");

  if (queryTicketId) {
    return queryTicketId;
  }

  const segments =
    window.location.pathname
      .split("/")
      .filter(Boolean);

  if (
    segments[0] === "tickets" &&
    segments.length > 1
  ) {
    try {
      return decodeURIComponent(
        segments[1]
      );
    } catch {
      return segments[1];
    }
  }

  return "";
}

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function readStoredTickets() {
  const storageKeys = [
    "fixflow_my_tickets",
    "fixflow_reporter_tickets",
    "fixflow_public_tickets",
    "fixflow_tickets",
  ];

  const collectedTickets = [];

  storageKeys.forEach(
    (storageKey) => {
      try {
        const storedValue =
          localStorage.getItem(
            storageKey
          );

        const parsedValue =
          storedValue
            ? JSON.parse(storedValue)
            : [];

        if (
          Array.isArray(parsedValue)
        ) {
          collectedTickets.push(
            ...parsedValue
          );
        }
      } catch {
        return;
      }
    }
  );

  const uniqueTickets =
    new Map();

  collectedTickets.forEach(
    (ticket) => {
      const key = String(
        ticket.id ||
          ticket.ticket_number ||
          ticket.ticketNumber
      );

      if (key) {
        uniqueTickets.set(
          key,
          ticket
        );
      }
    }
  );

  return [
    ...uniqueTickets.values(),
  ];
}

function saveTicketToStorage(
  updatedTicket
) {
  const storageKeys = [
    "fixflow_my_tickets",
    "fixflow_reporter_tickets",
    "fixflow_public_tickets",
    "fixflow_tickets",
  ];

  storageKeys.forEach(
    (storageKey) => {
      try {
        const storedValue =
          localStorage.getItem(
            storageKey
          );

        if (!storedValue) {
          return;
        }

        const parsedValue =
          JSON.parse(storedValue);

        if (
          !Array.isArray(parsedValue)
        ) {
          return;
        }

        const ticketExists =
          parsedValue.some(
            (ticket) =>
              String(ticket.id) ===
                String(
                  updatedTicket.id
                ) ||
              String(
                ticket.ticket_number
              ) ===
                String(
                  updatedTicket
                    .ticket_number
                )
          );

        if (!ticketExists) {
          return;
        }

        const nextTickets =
          parsedValue.map(
            (ticket) => {
              const matches =
                String(ticket.id) ===
                  String(
                    updatedTicket.id
                  ) ||
                String(
                  ticket.ticket_number
                ) ===
                  String(
                    updatedTicket
                      .ticket_number
                  );

              return matches
                ? updatedTicket
                : ticket;
            }
          );

        localStorage.setItem(
          storageKey,
          JSON.stringify(
            nextTickets
          )
        );
      } catch {
        return;
      }
    }
  );
}

function getTicketNumber(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    "—"
  );
}

function getLocationName(ticket) {
  return (
    ticket?.location_name ||
    ticket?.location?.name ||
    ticket?.locations?.name ||
    "موقع غير محدد"
  );
}

function getAssetName(ticket) {
  return (
    ticket?.asset_name ||
    ticket?.asset?.name ||
    ticket?.assets?.name ||
    "دون جهاز محدد"
  );
}

function getAssetNumber(ticket) {
  return (
    ticket?.asset_number ||
    ticket?.asset?.asset_number ||
    ticket?.assets?.asset_number ||
    "—"
  );
}

function getCategoryName(ticket) {
  return (
    ticket?.category_name ||
    ticket?.category?.name ||
    ticket?.categories?.name ||
    "دون تصنيف"
  );
}

function getTechnicianName(ticket) {
  return (
    ticket?.technician_name ||
    ticket?.assigned_technician
      ?.full_name ||
    ticket?.technician?.full_name ||
    ticket?.profiles?.full_name ||
    "غير معيّن"
  );
}

function getTechnicianSpecialization(
  ticket
) {
  return (
    ticket?.assigned_technician
      ?.specialization ||
    ticket?.technician
      ?.specialization ||
    ticket?.profiles
      ?.specialization ||
    "فني صيانة"
  );
}

function getReporterName(ticket) {
  return (
    ticket?.reporter_name ||
    ticket?.reporterName ||
    ticket?.reporter_profile
      ?.full_name ||
    "مبلّغ غير معروف"
  );
}

function getReporterEmail(ticket) {
  return (
    ticket?.reporter_email ||
    ticket?.reporterEmail ||
    ticket?.reporter_profile?.email ||
    "—"
  );
}

function getReporterPhone(ticket) {
  return (
    ticket?.reporter_phone ||
    ticket?.reporterPhone ||
    ticket?.reporter_profile?.phone ||
    "—"
  );
}

function getAttachments(ticket) {
  const attachments =
    ticket?.ticket_attachments ||
    ticket?.attachments ||
    [];

  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((attachment) => ({
      ...attachment,

      url:
        attachment.public_url ||
        attachment.signed_url ||
        attachment.file_url ||
        attachment.url ||
        "",

      name:
        attachment.file_name ||
        attachment.filename ||
        attachment.title ||
        attachment.storage_path ||
        "مرفق",

      type: String(
        attachment.attachment_type ||
          attachment.type ||
          "OTHER"
      ).toUpperCase(),
    }))
    .filter(
      (attachment) =>
        attachment.url
    );
}

function getComments(ticket) {
  const comments =
    ticket?.ticket_comments ||
    ticket?.comments ||
    [];

  return Array.isArray(comments)
    ? comments
    : [];
}

function getHistory(ticket) {
  const history =
    ticket?.ticket_history ||
    ticket?.history ||
    [];

  return Array.isArray(history)
    ? history
    : [];
}

function isTicketOwnedByReporter(
  ticket,
  user
) {
  if (!ticket || !user) {
    return false;
  }

  const reporterUserId =
    ticket.reporter_user_id ||
    ticket.reporterUserId ||
    ticket.reporter_profile?.id ||
    null;

  if (
    reporterUserId &&
    user.id &&
    String(reporterUserId) ===
      String(user.id)
  ) {
    return true;
  }

  const userEmail =
    normalizeValue(user.email);

  const reporterEmail =
    normalizeValue(
      ticket.reporter_email ||
        ticket.reporterEmail ||
        ticket.reporter_profile
          ?.email
    );

  if (
    userEmail &&
    reporterEmail === userEmail
  ) {
    return true;
  }

  const userPhone =
    normalizeValue(user.phone);

  const reporterPhone =
    normalizeValue(
      ticket.reporter_phone ||
        ticket.reporterPhone ||
        ticket.reporter_profile
          ?.phone
    );

  return Boolean(
    userPhone &&
      reporterPhone &&
      userPhone === reporterPhone
  );
}

function isOverdue(ticket) {
  if (
    !ticket ||
    ["CLOSED", "CANCELLED"].includes(
      ticket.status
    )
  ) {
    return false;
  }

  if (
    ticket.is_overdue === true ||
    ticket.isOverdue === true
  ) {
    return true;
  }

  if (
    !ticket.due_at &&
    !ticket.dueAt
  ) {
    return false;
  }

  const dueDate =
    new Date(
      ticket.due_at ||
        ticket.dueAt
    );

  return (
    !Number.isNaN(
      dueDate.getTime()
    ) &&
    dueDate.getTime() <
      Date.now()
  );
}

function createHistoryEntry({
  action,
  actorName,
  oldStatus,
  newStatus,
  note,
}) {
  return {
    id:
      `history-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

    action,

    actor_name:
      actorName,

    old_status:
      oldStatus || null,

    new_status:
      newStatus || null,

    note:
      note || null,

    is_internal: false,

    created_at:
      new Date().toISOString(),
  };
}

/* ==================================================
   صفحة تفاصيل الطلب
================================================== */

export default function TicketDetailsPage({
  ticketId:
    explicitTicketId = "",
}) {
  const {
    user,
    fullName,

    isRegisteredReporter,
    isTechnician,

    can,
    canAccessTicket,
  } = useAuth();

  const ticketId = useMemo(
    () =>
      resolveTicketId(
        explicitTicketId
      ),
    [explicitTicketId]
  );

  const canAssign = can(
    PERMISSION.TICKETS_ASSIGN
  );

  const canApprove = can(
    PERMISSION.TICKETS_APPROVE
  );

  const canWork =
    can(PERMISSION.TICKETS_WORK) ||
    isTechnician;

  const returnPath =
    isRegisteredReporter
      ? "/"
      : isTechnician
        ? "/my-tickets"
        : "/tickets";

  const returnLabel =
    isRegisteredReporter
      ? "العودة إلى بلاغاتي"
      : isTechnician
        ? "العودة إلى مهامي"
        : "العودة إلى الطلبات";

  const [ticket, setTicket] =
    useState(null);

  const [
    technicians,
    setTechnicians,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [updating, setUpdating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    assignModalOpen,
    setAssignModalOpen,
  ] = useState(false);

  const [
    closeModalOpen,
    setCloseModalOpen,
  ] = useState(false);

  const [workNote, setWorkNote] =
    useState("");

  const [
    reporterNote,
    setReporterNote,
  ] = useState("");

  useEffect(() => {
    loadTicket();
  }, [
    ticketId,
    user?.id,
    user?.email,
    isRegisteredReporter,
  ]);

  useEffect(() => {
    if (canAssign) {
      loadTechnicians();
    }
  }, [canAssign]);

  async function loadTicket() {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (
        !isSupabaseConfigured
      ) {
        const storedTicket =
          readStoredTickets().find(
            (item) =>
              String(item.id) ===
                String(ticketId) ||
              String(
                item.ticket_number
              ) === String(ticketId)
          );

        let selectedTicket =
          storedTicket ||
          (ticketId
            ? {
                ...DEMO_TICKET,
                id: ticketId,
              }
            : DEMO_TICKET);

        /*
         * عند تجربة حساب المبلّغ،
         * نربط البلاغ التجريبي به.
         */
        if (
          isRegisteredReporter &&
          !storedTicket
        ) {
          selectedTicket = {
            ...selectedTicket,

            reporter_user_id:
              user?.id || null,

            reporter_name:
              fullName ||
              user?.full_name ||
              user?.name ||
              selectedTicket
                .reporter_name,

            reporter_email:
              user?.email ||
              selectedTicket
                .reporter_email,

            reporter_phone:
              user?.phone ||
              selectedTicket
                .reporter_phone,
          };
        }

        if (
          isRegisteredReporter &&
          !isTicketOwnedByReporter(
            selectedTicket,
            user
          )
        ) {
          throw new Error(
            "FORBIDDEN"
          );
        }

        setTicket(
          selectedTicket
        );

        return;
      }

      if (!ticketId) {
        throw new Error(
          "TICKET_ID_REQUIRED"
        );
      }

      const result =
        await getTicket(ticketId);

      if (
        isRegisteredReporter &&
        !isTicketOwnedByReporter(
          result,
          user
        )
      ) {
        throw new Error(
          "FORBIDDEN"
        );
      }

      if (
        !isRegisteredReporter &&
        typeof canAccessTicket ===
          "function" &&
        !canAccessTicket(result)
      ) {
        throw new Error(
          "FORBIDDEN"
        );
      }

      setTicket(result);
    } catch (loadError) {
      const message = String(
        loadError?.message || ""
      ).toUpperCase();

      if (
        message.includes(
          "FORBIDDEN"
        ) ||
        message.includes(
          "ROW-LEVEL SECURITY"
        ) ||
        message.includes("42501")
      ) {
        setError(
          "لا تملك صلاحية مشاهدة هذا الطلب."
        );
      } else if (
        message.includes(
          "PGRST116"
        ) ||
        message.includes(
          "NOT_FOUND"
        )
      ) {
        setError(
          "لم يتم العثور على طلب الصيانة."
        );
      } else if (
        message.includes(
          "TICKET_ID_REQUIRED"
        )
      ) {
        setError(
          "رقم طلب الصيانة غير موجود في الرابط."
        );
      } else {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "تعذر تحميل تفاصيل الطلب."
        );
      }

      setTicket(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadTechnicians() {
    try {
      if (
        !isSupabaseConfigured
      ) {
        setTechnicians(
          DEMO_TECHNICIANS
        );

        return;
      }

      const {
        data,
        error:
          techniciansError,
      } =
        await requireSupabase()
          .from("profiles")
          .select(
            `
              id,
              full_name,
              email,
              role,
              specialization,
              availability_status,
              is_active,
              organization_id,
              user_locations(location_id)
            `
          )
          .eq(
            "role",
            "TECHNICIAN"
          )
          .eq(
            "is_active",
            true
          )
          .order("full_name");

      if (
        techniciansError
      ) {
        throw techniciansError;
      }

      setTechnicians(
        data || []
      );
    } catch {
      setTechnicians([]);
    }
  }

  async function handleAssign({
    technicianId,
    note,
  }) {
    if (
      !ticket ||
      updating ||
      !canAssign
    ) {
      return;
    }

    setUpdating(true);
    setError("");
    setSuccessMessage("");

    try {
      const selectedTechnician =
        technicians.find(
          (technician) =>
            String(
              technician.id
            ) ===
            String(
              technicianId
            )
        );

      let updatedTicket;

      if (
        !isSupabaseConfigured
      ) {
        const historyEntry =
          createHistoryEntry({
            action: "ASSIGNED",

            actorName:
              fullName ||
              user?.full_name ||
              "مشرف الصيانة",

            oldStatus:
              ticket.status,

            newStatus:
              "ASSIGNED",

            note:
              note ||
              `تم تعيين الفني ${
                selectedTechnician
                  ?.full_name ||
                "المحدد"
              }.`,
          });

        updatedTicket = {
          ...ticket,

          status: "ASSIGNED",

          assigned_technician_id:
            technicianId,

          profiles:
            selectedTechnician
              ? {
                  id:
                    selectedTechnician
                      .id,

                  full_name:
                    selectedTechnician
                      .full_name,

                  specialization:
                    selectedTechnician
                      .specialization,
                }
              : ticket.profiles,

          updated_at:
            new Date()
              .toISOString(),

          ticket_history: [
            historyEntry,
            ...getHistory(ticket),
          ],
        };

        saveTicketToStorage(
          updatedTicket
        );
      } else {
        const result =
          await assignTechnician(
            ticket.id,
            technicianId,
            note || null
          );

        updatedTicket = {
          ...ticket,
          ...(result?.ticket ||
            result ||
            {}),

          status: "ASSIGNED",

          assigned_technician_id:
            technicianId,

          profiles:
            selectedTechnician
              ? {
                  id:
                    selectedTechnician
                      .id,

                  full_name:
                    selectedTechnician
                      .full_name,

                  specialization:
                    selectedTechnician
                      .specialization,
                }
              : ticket.profiles,

          updated_at:
            new Date()
              .toISOString(),
        };
      }

      setTicket(
        updatedTicket
      );

      setAssignModalOpen(
        false
      );

      setSuccessMessage(
        `تم تعيين الفني ${
          selectedTechnician
            ?.full_name || ""
        } للطلب.`
      );
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "تعذر تعيين الفني."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleStatusChange(
    nextStatus
  ) {
    if (
      !ticket ||
      updating ||
      !canWork
    ) {
      return;
    }

    const action = (
      TECHNICIAN_ACTIONS[
        ticket.status
      ] || []
    ).find(
      (item) =>
        item.nextStatus ===
        nextStatus
    );

    const normalizedNote =
      workNote.trim();

    if (
      action?.requiresNote &&
      normalizedNote.length < 5
    ) {
      setError(
        nextStatus ===
          "WAITING_PARTS"
          ? "اكتب اسم القطعة المطلوبة أو سبب الانتظار."
          : "اكتب ملخصًا للإصلاح قبل إرساله للاعتماد."
      );

      return;
    }

    setUpdating(true);
    setError("");
    setSuccessMessage("");

    try {
      let updatedTicket;

      if (
        !isSupabaseConfigured
      ) {
        const actionName =
          nextStatus ===
          "ACCEPTED"
            ? "ACCEPTED"
            : nextStatus ===
                "IN_PROGRESS"
              ? "STARTED"
              : nextStatus ===
                  "PENDING_APPROVAL"
                ? "COMPLETED"
                : "STATUS_CHANGED";

        const historyEntry =
          createHistoryEntry({
            action:
              actionName,

            actorName:
              fullName ||
              user?.full_name ||
              "فني الصيانة",

            oldStatus:
              ticket.status,

            newStatus:
              nextStatus,

            note:
              normalizedNote,
          });

        updatedTicket = {
          ...ticket,

          status:
            nextStatus,

          resolution_summary:
            nextStatus ===
            "PENDING_APPROVAL"
              ? normalizedNote
              : ticket
                  .resolution_summary,

          started_at:
            nextStatus ===
              "IN_PROGRESS" &&
            !ticket.started_at
              ? new Date()
                  .toISOString()
              : ticket.started_at,

          completed_at:
            nextStatus ===
            "PENDING_APPROVAL"
              ? new Date()
                  .toISOString()
              : ticket.completed_at,

          updated_at:
            new Date()
              .toISOString(),

          ticket_history: [
            historyEntry,
            ...getHistory(ticket),
          ],
        };

        saveTicketToStorage(
          updatedTicket
        );
      } else {
        const result =
          await changeStatus(
            ticket,
            nextStatus,
            normalizedNote ||
              null
          );

        updatedTicket = {
          ...ticket,
          ...(result?.ticket ||
            result ||
            {}),

          status:
            nextStatus,

          updated_at:
            new Date()
              .toISOString(),
        };
      }

      setTicket(
        updatedTicket
      );

      setWorkNote("");

      setSuccessMessage(
        `تم تغيير حالة الطلب إلى ${getStatusLabel(
          nextStatus
        )}.`
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "تعذر تحديث حالة الطلب."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleApproval({
    decision,
    nextStatus,
    note,
  }) {
    if (
      !ticket ||
      updating ||
      !canApprove
    ) {
      return;
    }

    setUpdating(true);
    setError("");
    setSuccessMessage("");

    try {
      let updatedTicket;

      if (
        !isSupabaseConfigured
      ) {
        const historyEntry =
          createHistoryEntry({
            action:
              decision ===
              "APPROVE"
                ? "CLOSED"
                : "STATUS_CHANGED",

            actorName:
              fullName ||
              user?.full_name ||
              "مشرف الصيانة",

            oldStatus:
              ticket.status,

            newStatus:
              nextStatus,

            note,
          });

        updatedTicket = {
          ...ticket,

          status:
            nextStatus,

          closed_at:
            nextStatus ===
            "CLOSED"
              ? new Date()
                  .toISOString()
              : ticket.closed_at,

          updated_at:
            new Date()
              .toISOString(),

          ticket_history: [
            historyEntry,
            ...getHistory(ticket),
          ],
        };

        saveTicketToStorage(
          updatedTicket
        );
      } else {
        const result =
          decision === "APPROVE"
            ? await approveTicketResolution(ticket.id, note)
            : await changeStatus(ticket, nextStatus, note);

        const effectiveStatus =
          decision === "APPROVE"
            ? "PENDING_APPROVAL"
            : nextStatus;

        updatedTicket = {
          ...ticket,
          ...(result?.ticket ||
            result ||
            {}),

          status: effectiveStatus,

          supervisor_approved_at:
            decision === "APPROVE"
              ? result?.supervisor_approved_at || new Date().toISOString()
              : ticket.supervisor_approved_at,

          updated_at:
            new Date()
              .toISOString(),
        };
      }

      setTicket(
        updatedTicket
      );

      setCloseModalOpen(
        false
      );

      setSuccessMessage(
        decision === "APPROVE"
          ? "تم اعتماد الإصلاح وإغلاق الطلب."
          : "تمت إعادة الطلب إلى الفني لمعالجة الملاحظات."
      );
    } catch (
      approvalError
    ) {
      setError(
        approvalError instanceof
          Error
          ? approvalError.message
          : "تعذر حفظ قرار الاعتماد."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleReporterDecision(
    nextStatus
  ) {
    if (
      !ticket ||
      updating ||
      !isRegisteredReporter
    ) {
      return;
    }

    const normalizedNote =
      reporterNote.trim();

    if (
      nextStatus ===
        "REOPENED" &&
      normalizedNote.length < 5
    ) {
      setError(
        "اكتب سبب إعادة فتح البلاغ بوضوح."
      );

      return;
    }

    setUpdating(true);
    setError("");
    setSuccessMessage("");

    try {
      let updatedTicket;

      if (
        !isSupabaseConfigured
      ) {
        const historyEntry =
          createHistoryEntry({
            action:
              nextStatus ===
              "CLOSED"
                ? "CLOSED"
                : "REOPENED",

            actorName:
              fullName ||
              user?.full_name ||
              user?.name ||
              "المبلّغ",

            oldStatus:
              ticket.status,

            newStatus:
              nextStatus,

            note:
              normalizedNote ||
              (nextStatus ===
              "CLOSED"
                ? "تم تأكيد نجاح الإصلاح بواسطة المبلّغ."
                : "تمت إعادة فتح البلاغ بواسطة المبلّغ."),
          });

        updatedTicket = {
          ...ticket,

          status:
            nextStatus,

          closed_at:
            nextStatus ===
            "CLOSED"
              ? new Date()
                  .toISOString()
              : ticket.closed_at,

          updated_at:
            new Date()
              .toISOString(),

          ticket_history: [
            historyEntry,
            ...getHistory(ticket),
          ],
        };

        saveTicketToStorage(
          updatedTicket
        );
      } else {
        const result =
          await changeStatus(
            ticket,
            nextStatus,
            normalizedNote ||
              null
          );

        updatedTicket = {
          ...ticket,
          ...(result?.ticket ||
            result ||
            {}),

          status:
            nextStatus,

          updated_at:
            new Date()
              .toISOString(),
        };
      }

      setTicket(
        updatedTicket
      );

      setReporterNote("");

      setSuccessMessage(
        nextStatus === "CLOSED"
          ? "تم تأكيد الإصلاح وإغلاق البلاغ."
          : "تمت إعادة فتح البلاغ وإرساله إلى فريق الصيانة."
      );
    } catch (
      reporterError
    ) {
      setError(
        reporterError instanceof
          Error
          ? reporterError.message
          : "تعذر حفظ قرارك."
      );
    } finally {
      setUpdating(false);
    }
  }

  /* ==================================================
     البيانات المحسوبة
  ================================================== */

  const attachments =
    useMemo(
      () =>
        getAttachments(ticket),
      [ticket]
    );

  const comments = useMemo(
    () => {
      const allComments =
        getComments(ticket);

      if (
        !isRegisteredReporter
      ) {
        return allComments;
      }

      return allComments.filter(
        (comment) =>
          comment.is_internal !==
            true &&
          comment.isInternal !==
            true
      );
    },
    [
      ticket,
      isRegisteredReporter,
    ]
  );

  const visibleHistory =
    useMemo(
      () => {
        const history =
          getHistory(ticket);

        if (
          !isRegisteredReporter
        ) {
          return history;
        }

        return history.filter(
          (entry) =>
            entry.is_internal !==
              true &&
            entry.isInternal !==
              true
        );
      },
      [
        ticket,
        isRegisteredReporter,
      ]
    );

  const workActions =
    TECHNICIAN_ACTIONS[
      ticket?.status
    ] || [];

  const technicianOwnsTicket =
    Boolean(
      user?.id &&
        ticket
          ?.assigned_technician_id &&
        String(
          ticket
            .assigned_technician_id
        ) === String(user.id)
    );

  const reporterCanConfirm =
    isRegisteredReporter &&
    ticket?.status ===
      "PENDING_APPROVAL";

  const reporterCanReopen =
    isRegisteredReporter &&
    [
      "PENDING_APPROVAL",
      "CLOSED",
    ].includes(ticket?.status);

  /* ==================================================
     حالات التحميل والخطأ
  ================================================== */

  if (loading) {
    return (
      <section
        className="panel"
        role="status"
        aria-live="polite"
        style={{
          display: "grid",
          gap: "12px",
          padding: "24px",
        }}
      >
        {[1, 2, 3, 4, 5].map(
          (item) => (
            <div
              key={item}
              style={{
                height:
                  item === 1
                    ? "70px"
                    : "48px",

                borderRadius:
                  "10px",

                background:
                  "#edf1f0",
              }}
            />
          )
        )}

        <span className="empty">
          جاري تحميل تفاصيل
          الطلب…
        </span>
      </section>
    );
  }

  if (error && !ticket) {
    return (
      <section className="panel">
        <EmptyState
          icon="!"
          title="تعذر فتح الطلب"
          description={error}
          actionLabel={
            returnLabel
          }
          onAction={() =>
            navigate(returnPath)
          }
        />
      </section>
    );
  }

  if (!ticket) {
    return null;
  }

  /* ==================================================
     واجهة الصفحة
  ================================================== */

  return (
    <>
      <div className="page-header">
        <div>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              navigate(
                returnPath
              )
            }
            style={{
              padding: 0,
              marginBottom:
                "8px",
            }}
          >
            → {returnLabel}
          </button>

          <small>
            {getTicketNumber(
              ticket
            )}
          </small>

          <h1>
            {ticket.title ||
              "طلب صيانة"}
          </h1>

          <p>
            آخر تحديث:{" "}
            {formatDate(
              ticket.updated_at ||
                ticket.updatedAt ||
                ticket.created_at,
              {
                withTime: true,
              }
            )}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent:
              "flex-end",
            gap: "8px",
          }}
        >
          <TicketPriorityBadge
            priority={
              ticket.priority
            }
          />

          <TicketStatusBadge
            status={
              ticket.status
            }
          />

          {isOverdue(ticket) ? (
            <span
              className="badge"
              style={{
                color:
                  "#a84132",

                background:
                  "#fae8e4",
              }}
            >
              متأخر
            </span>
          ) : null}
        </div>
      </div>

      {isRegisteredReporter &&
      ticket.status ===
        "PENDING_APPROVAL" ? (
        <div
          className="demo-callout"
          style={{
            marginBottom:
              "16px",
          }}
        >
          <strong>
            الصيانة جاهزة للتأكيد
          </strong>

          <span>
            راجع ملخص الإصلاح
            والصور، ثم أكد نجاح
            الإصلاح أو أعد فتح
            البلاغ.
          </span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="demo-callout"
          role="status"
          aria-live="polite"
          style={{
            marginBottom:
              "16px",
          }}
        >
          <strong>
            تمت العملية بنجاح
          </strong>

          <span>
            {successMessage}
          </span>
        </div>
      ) : null}

      {error ? (
        <div
          className="form-error"
          role="alert"
          aria-live="assertive"
          style={{
            marginBottom:
              "16px",
          }}
        >
          {error}
        </div>
      ) : null}

      <section className="content-grid">
        <div
          style={{
            display: "grid",
            alignContent:
              "start",
            gap: "18px",
          }}
        >
          {/* معلومات الطلب */}
          <article
            className="panel"
            style={{
              display: "grid",
              gap: "20px",
              padding: "22px",
            }}
          >
            <div
              className="panel-head"
              style={{
                padding: 0,
              }}
            >
              <div>
                <h2>
                  معلومات الطلب
                </h2>

                <p>
                  تفاصيل المشكلة
                  والموقع والجهاز
                  المرتبط
                </p>
              </div>
            </div>

            <div className="asset-box">
              <span
                aria-hidden="true"
              >
                ⌁
              </span>

              <div>
                <small>
                  الجهاز أو الأصل
                </small>

                <strong>
                  {getAssetName(
                    ticket
                  )}
                </strong>

                <p>
                  {getAssetNumber(
                    ticket
                  )}
                  {" · "}
                  {getLocationName(
                    ticket
                  )}
                </p>
              </div>
            </div>

            <dl
              style={{
                display: "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",

                gap: "13px",
                margin: 0,
              }}
            >
              <div
                style={{
                  padding:
                    "13px",

                  borderRadius:
                    "9px",

                  background:
                    "#f6f9f8",
                }}
              >
                <dt
                  style={{
                    color:
                      "#82908e",

                    fontSize:
                      "8px",
                  }}
                >
                  التصنيف
                </dt>

                <dd
                  style={{
                    margin:
                      "5px 0 0",

                    fontSize:
                      "10px",

                    fontWeight:
                      700,
                  }}
                >
                  {getCategoryName(
                    ticket
                  )}
                </dd>
              </div>

              <div
                style={{
                  padding:
                    "13px",

                  borderRadius:
                    "9px",

                  background:
                    "#f6f9f8",
                }}
              >
                <dt
                  style={{
                    color:
                      "#82908e",

                    fontSize:
                      "8px",
                  }}
                >
                  الأولوية
                </dt>

                <dd
                  style={{
                    margin:
                      "5px 0 0",

                    fontSize:
                      "10px",

                    fontWeight:
                      700,
                  }}
                >
                  {getPriorityLabel(
                    ticket.priority
                  )}
                </dd>
              </div>

              <div
                style={{
                  padding:
                    "13px",

                  borderRadius:
                    "9px",

                  background:
                    "#f6f9f8",
                }}
              >
                <dt
                  style={{
                    color:
                      "#82908e",

                    fontSize:
                      "8px",
                  }}
                >
                  تاريخ الإنشاء
                </dt>

                <dd
                  style={{
                    margin:
                      "5px 0 0",

                    fontSize:
                      "9px",

                    fontWeight:
                      700,
                  }}
                >
                  {formatDate(
                    ticket.created_at,
                    {
                      withTime:
                        true,
                    }
                  )}
                </dd>
              </div>

              <div
                style={{
                  padding:
                    "13px",

                  borderRadius:
                    "9px",

                  background:
                    "#f6f9f8",
                }}
              >
                <dt
                  style={{
                    color:
                      "#82908e",

                    fontSize:
                      "8px",
                  }}
                >
                  موعد الاستحقاق
                </dt>

                <dd
                  className={
                    isOverdue(ticket)
                      ? "danger-text"
                      : ""
                  }
                  style={{
                    margin:
                      "5px 0 0",

                    fontSize:
                      "9px",

                    fontWeight:
                      700,
                  }}
                >
                  {ticket.due_at
                    ? formatDate(
                        ticket.due_at,
                        {
                          withTime:
                            true,
                        }
                      )
                    : "غير محدد"}
                </dd>
              </div>
            </dl>

            <section
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize:
                    "12px",
                }}
              >
                وصف المشكلة
              </h3>

              <p
                className="description"
                style={{
                  margin: 0,

                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {ticket.description ||
                  "لم يتم إضافة وصف للمشكلة."}
              </p>
            </section>

            {ticket.resolution_summary ||
            ticket.resolution ? (
              <section
                style={{
                  display:
                    "grid",

                  gap: "8px",
                }}
              >
                <h3
                  style={{
                    margin: 0,

                    fontSize:
                      "12px",
                  }}
                >
                  ملخص الإصلاح
                </h3>

                <p
                  className="description"
                  style={{
                    margin: 0,

                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {ticket
                    .resolution_summary ||
                    ticket
                      .resolution}
                </p>
              </section>
            ) : null}
          </article>

          {/* المرفقات */}
          <article
            className="panel"
            style={{
              display: "grid",
              gap: "16px",
              padding: "22px",
            }}
          >
            <div
              className="panel-head"
              style={{
                padding: 0,
              }}
            >
              <div>
                <h2>
                  المرفقات
                </h2>

                <p>
                  صور المشكلة
                  والإصلاح المرفوعة
                  على الطلب
                </p>
              </div>
            </div>

            {attachments.length ===
            0 ? (
              <div className="empty">
                لا توجد مرفقات لهذا
                الطلب.
              </div>
            ) : (
              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(150px, 1fr))",

                  gap: "12px",
                }}
              >
                {attachments.map(
                  (attachment) => (
                    <a
                      key={
                        attachment.id ||
                        attachment.url
                      }
                      href={
                        attachment.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display:
                          "grid",

                        gap: "7px",

                        color:
                          "inherit",

                        textDecoration:
                          "none",
                      }}
                    >
                      <img
                        src={
                          attachment.url
                        }
                        alt={
                          attachment.name
                        }
                        loading="lazy"
                        style={{
                          width:
                            "100%",

                          height:
                            "130px",

                          objectFit:
                            "cover",

                          border:
                            "1px solid #dfe6e4",

                          borderRadius:
                            "10px",

                          background:
                            "#f5f7f6",
                        }}
                      />

                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap: "8px",
                        }}
                      >
                        <small
                          style={{
                            overflow:
                              "hidden",

                            color:
                              "#536663",

                            textOverflow:
                              "ellipsis",

                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            attachment.name
                          }
                        </small>

                        <span className="badge slate">
                          {attachment.type ===
                          "BEFORE"
                            ? "قبل"
                            : attachment.type ===
                                "AFTER"
                              ? "بعد"
                              : "مرفق"}
                        </span>
                      </div>
                    </a>
                  )
                )}
              </div>
            )}
          </article>

          {/* سجل الطلب */}
          <article
            className="panel"
            style={{
              display: "grid",
              gap: "16px",
              padding: "22px",
            }}
          >
            <div
              className="panel-head"
              style={{
                padding: 0,
              }}
            >
              <div>
                <h2>
                  سجل الطلب
                </h2>

                <p>
                  جميع التحديثات
                  والتغييرات التي تمت
                </p>
              </div>
            </div>

            <TicketTimeline
              history={
                visibleHistory
              }
              ticket={ticket}
              order="desc"
            />
          </article>
        </div>

        <aside
          className="side-column"
          style={{
            alignContent:
              "start",
          }}
        >
          {/* الفني المسؤول */}
          <article
            className="panel"
            style={{
              display: "grid",
              gap: "15px",
              padding: "20px",
            }}
          >
            <div
              className="panel-head"
              style={{
                padding: 0,
              }}
            >
              <div>
                <h2>
                  الفني المسؤول
                </h2>

                <p>
                  الفني المعيّن لتنفيذ
                  الصيانة
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: "11px",
                padding: "13px",

                borderRadius:
                  "10px",

                background:
                  "#f6f9f8",
              }}
            >
              <span
                className="mini-avatar"
                aria-hidden="true"
              >
                {getTechnicianName(
                  ticket
                )
                  .trim()
                  .charAt(0)}
              </span>

              <div
                style={{
                  display:
                    "grid",

                  gap: "4px",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "10px",
                  }}
                >
                  {getTechnicianName(
                    ticket
                  )}
                </strong>

                <small
                  style={{
                    color:
                      "#82908e",
                  }}
                >
                  {getTechnicianSpecialization(
                    ticket
                  )}
                </small>
              </div>
            </div>

            {canAssign ? (
              <button
                type="button"
                className="secondary wide"
                onClick={() =>
                  setAssignModalOpen(
                    true
                  )
                }
                disabled={
                  updating
                }
              >
                {ticket
                  .assigned_technician_id
                  ? "تغيير الفني"
                  : "تعيين فني"}
              </button>
            ) : null}
          </article>

          {/* بيانات المبلّغ — مخفية عن المبلّغ نفسه */}
          {!isRegisteredReporter ? (
            <article
              className="panel"
              style={{
                display:
                  "grid",

                gap: "14px",

                padding:
                  "20px",
              }}
            >
              <div
                className="panel-head"
                style={{
                  padding: 0,
                }}
              >
                <div>
                  <h2>
                    بيانات المبلّغ
                  </h2>

                  <p>
                    وسائل التواصل
                    الخاصة بالبلاغ
                  </p>
                </div>
              </div>

              <div
                style={{
                  display:
                    "grid",

                  gap: "11px",

                  fontSize:
                    "9px",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#82908e",
                    }}
                  >
                    الاسم
                  </span>

                  <strong>
                    {getReporterName(
                      ticket
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#82908e",
                    }}
                  >
                    الجوال
                  </span>

                  <strong dir="ltr">
                    {getReporterPhone(
                      ticket
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#82908e",
                    }}
                  >
                    البريد
                  </span>

                  <strong
                    dir="ltr"
                    style={{
                      overflow:
                        "hidden",

                      maxWidth:
                        "150px",

                      textOverflow:
                        "ellipsis",
                    }}
                  >
                    {getReporterEmail(
                      ticket
                    )}
                  </strong>
                </div>
              </div>
            </article>
          ) : null}

          {/* أدوات الفني */}
          {canWork &&
          technicianOwnsTicket &&
          workActions.length >
            0 ? (
            <article
              className="panel"
              style={{
                display:
                  "grid",

                gap: "14px",

                padding:
                  "20px",
              }}
            >
              <div
                className="panel-head"
                style={{
                  padding: 0,
                }}
              >
                <div>
                  <h2>
                    تحديث حالة العمل
                  </h2>

                  <p>
                    سجّل تقدم الصيانة
                    على الطلب
                  </p>
                </div>
              </div>

              <label>
                ملاحظة العمل

                <textarea
                  value={
                    workNote
                  }
                  onChange={(
                    event
                  ) => {
                    setWorkNote(
                      event.target
                        .value
                    );

                    setError("");
                  }}
                  placeholder="اكتب تفاصيل العمل أو القطعة المطلوبة..."
                  disabled={
                    updating
                  }
                  maxLength={
                    1000
                  }
                />
              </label>

              <div
                style={{
                  display:
                    "grid",

                  gap: "8px",
                }}
              >
                {workActions.map(
                  (action) => (
                    <button
                      key={
                        action.nextStatus
                      }
                      type="button"
                      className={`${action.className} wide`}
                      onClick={() =>
                        handleStatusChange(
                          action.nextStatus
                        )
                      }
                      disabled={
                        updating
                      }
                    >
                      {updating
                        ? "جاري الحفظ…"
                        : action.label}
                    </button>
                  )
                )}
              </div>
            </article>
          ) : null}

          {/* اعتماد الإدارة */}
          {canApprove &&
          ticket.status ===
            "PENDING_APPROVAL" ? (
            <article
              className="panel"
              style={{
                display:
                  "grid",

                gap: "13px",

                padding:
                  "20px",
              }}
            >
              <span
                className="stat-icon green-bg"
                aria-hidden="true"
              >
                ✓
              </span>

              <div>
                <h2
                  style={{
                    margin:
                      "0 0 6px",

                    fontSize:
                      "13px",
                  }}
                >
                  الطلب جاهز للاعتماد
                </h2>

                <p
                  style={{
                    margin: 0,

                    color:
                      "#71817f",

                    fontSize:
                      "9px",

                    lineHeight:
                      1.8,
                  }}
                >
                  راجع ملخص الإصلاح
                  والصور ثم احفظ قرار
                  الاعتماد.
                </p>
              </div>

              <button
                type="button"
                className="primary wide"
                onClick={() =>
                  setCloseModalOpen(
                    true
                  )
                }
                disabled={
                  updating
                }
              >
                مراجعة واعتماد
                الإصلاح
              </button>
            </article>
          ) : null}

          {/* قرار المبلّغ */}
          {isRegisteredReporter &&
          (reporterCanConfirm ||
            reporterCanReopen) ? (
            <article
              className="panel"
              style={{
                display:
                  "grid",

                gap: "14px",

                padding:
                  "20px",
              }}
            >
              <div
                className="panel-head"
                style={{
                  padding: 0,
                }}
              >
                <div>
                  <h2>
                    تأكيد الإصلاح
                  </h2>

                  <p>
                    أخبر فريق الصيانة
                    إن كانت المشكلة قد
                    حُلّت.
                  </p>
                </div>
              </div>

              <label>
                ملاحظتك

                <textarea
                  value={
                    reporterNote
                  }
                  onChange={(
                    event
                  ) => {
                    setReporterNote(
                      event.target
                        .value
                    );

                    setError("");
                  }}
                  placeholder="اكتب ملاحظتك، ويجب كتابة السبب عند إعادة فتح البلاغ..."
                  disabled={
                    updating
                  }
                  maxLength={
                    1000
                  }
                />
              </label>

              <div
                style={{
                  display:
                    "grid",

                  gap: "8px",
                }}
              >
                {reporterCanConfirm ? (
                  <button
                    type="button"
                    className="primary wide"
                    onClick={() =>
                      handleReporterDecision(
                        "CLOSED"
                      )
                    }
                    disabled={
                      updating
                    }
                  >
                    {updating
                      ? "جاري الحفظ…"
                      : "تأكيد نجاح الإصلاح"}
                  </button>
                ) : null}

                {reporterCanReopen ? (
                  <button
                    type="button"
                    className="secondary wide"
                    onClick={() =>
                      handleReporterDecision(
                        "REOPENED"
                      )
                    }
                    disabled={
                      updating
                    }
                  >
                    {updating
                      ? "جاري الحفظ…"
                      : "المشكلة ما زالت موجودة"}
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}

          {/* التعليقات */}
          <article
            className="panel"
            style={{
              display: "grid",
              gap: "13px",
              padding: "20px",
            }}
          >
            <div
              className="panel-head"
              style={{
                padding: 0,
              }}
            >
              <div>
                <h2>
                  التعليقات
                </h2>

                <p>
                  {isRegisteredReporter
                    ? "التحديثات العامة على البلاغ"
                    : "الملاحظات على الطلب"}
                </p>
              </div>
            </div>

            {comments.length ===
            0 ? (
              <div className="empty">
                لا توجد تعليقات حتى
                الآن.
              </div>
            ) : (
              comments.map(
                (
                  comment,
                  index
                ) => (
                  <article
                    key={
                      comment.id ||
                      index
                    }
                    style={{
                      display:
                        "grid",

                      gap: "6px",

                      padding:
                        "11px",

                      border:
                        "1px solid #e5eae8",

                      borderRadius:
                        "8px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize:
                          "9px",
                      }}
                    >
                      {comment
                        .author_name ||
                        comment
                          .profiles
                          ?.full_name ||
                        "مستخدم"}
                    </strong>

                    <p
                      style={{
                        margin: 0,

                        color:
                          "#536663",

                        fontSize:
                          "9px",

                        lineHeight:
                          1.7,
                      }}
                    >
                      {comment.comment ||
                        comment.content ||
                        comment.body}
                    </p>

                    <small
                      style={{
                        color:
                          "#82908e",
                      }}
                    >
                      {formatDate(
                        comment.created_at,
                        {
                          withTime:
                            true,
                        }
                      )}
                    </small>
                  </article>
                )
              )
            )}
          </article>
        </aside>
      </section>

      {/* نافذة تعيين الفني */}
      {canAssign ? (
        <AssignTechnicianModal
          open={
            assignModalOpen
          }
          ticket={ticket}
          technicians={
            technicians
          }
          busy={updating}
          error={error}
          onAssign={
            handleAssign
          }
          onClose={() => {
            if (!updating) {
              setAssignModalOpen(
                false
              );

              setError("");
            }
          }}
        />
      ) : null}

      {/* نافذة اعتماد الإصلاح */}
      {canApprove ? (
        <CloseTicketModal
          open={
            closeModalOpen
          }
          ticket={ticket}
          busy={updating}
          error={error}
          onConfirm={
            handleApproval
          }
          onClose={() => {
            if (!updating) {
              setCloseModalOpen(
                false
              );

              setError("");
            }
          }}
        />
      ) : null}
    </>
  );
}

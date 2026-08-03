import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  assignTechnician,
  changeStatus,
  createPublicTicket,
  getTicket,
  listTickets,
} from "../services/ticketService";
import useAuth from "./useAuth";

const STORAGE_KEY = "fixflow_tickets";

const DEFAULT_FILTERS = {
  search: "",
  status: "",
  priority: "",
  locationId: "",
  categoryId: "",
  technicianId: "",
  dateFrom: "",
  dateTo: "",
  overdueOnly: false,
  emergencyOnly: false,
};

function normalizeError(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallbackMessage;
}

function normalizeTicketsResult(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.tickets)) {
    return result.tickets;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.data?.tickets)) {
    return result.data.tickets;
  }

  return [];
}

function normalizeTicketResult(result, fallback = null) {
  return (
    result?.ticket ||
    result?.data?.ticket ||
    result?.data ||
    result ||
    fallback
  );
}

function readStoredTickets() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : [];
  } catch {
    return [];
  }
}

function saveStoredTickets(tickets) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(tickets)
    );

    return true;
  } catch {
    return false;
  }
}

function createLocalId(prefix = "ticket") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function getTicketNumber(ticket) {
  return (
    ticket?.ticket_number ||
    ticket?.ticketNumber ||
    ticket?.id ||
    ""
  );
}

function getLocationName(ticket) {
  return (
    ticket?.location_name ||
    ticket?.location?.name ||
    ticket?.locations?.name ||
    ""
  );
}

function getAssetName(ticket) {
  return (
    ticket?.asset_name ||
    ticket?.asset?.name ||
    ticket?.assets?.name ||
    ""
  );
}

function getCategoryName(ticket) {
  return (
    ticket?.category_name ||
    ticket?.category?.name ||
    ticket?.categories?.name ||
    ""
  );
}

function getTechnicianName(ticket) {
  return (
    ticket?.technician_name ||
    ticket?.assigned_technician?.full_name ||
    ticket?.technician?.full_name ||
    ticket?.profiles?.full_name ||
    ""
  );
}

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isTicketOverdue(ticket) {
  if (
    !ticket ||
    ["CLOSED", "CANCELLED"].includes(ticket.status)
  ) {
    return false;
  }

  if (
    ticket.is_overdue === true ||
    ticket.isOverdue === true
  ) {
    return true;
  }

  const dueAt = ticket.due_at || ticket.dueAt;
  const dueTimestamp = getTimestamp(dueAt);

  return (
    dueTimestamp > 0 &&
    dueTimestamp < Date.now()
  );
}

function matchesFilters(ticket, filters) {
  const normalizedSearch = String(
    filters.search || ""
  )
    .trim()
    .toLowerCase();

  const matchesSearch =
    !normalizedSearch ||
    [
      getTicketNumber(ticket),
      ticket?.title,
      ticket?.description,
      getLocationName(ticket),
      getAssetName(ticket),
      getCategoryName(ticket),
      getTechnicianName(ticket),
      ticket?.reporter_name,
      ticket?.reporter_email,
      ticket?.reporter_phone,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearch)
    );

  const matchesStatus =
    !filters.status ||
    ticket.status === filters.status;

  const matchesPriority =
    !filters.priority ||
    ticket.priority === filters.priority;

  const ticketLocationId =
    ticket.location_id ||
    ticket.locationId ||
    ticket.location?.id ||
    ticket.locations?.id ||
    "";

  const matchesLocation =
    !filters.locationId ||
    String(ticketLocationId) ===
      String(filters.locationId);

  const ticketCategoryId =
    ticket.category_id ||
    ticket.categoryId ||
    ticket.category?.id ||
    ticket.categories?.id ||
    "";

  const matchesCategory =
    !filters.categoryId ||
    String(ticketCategoryId) ===
      String(filters.categoryId);

  const assignedTechnicianId =
    ticket.assigned_technician_id ||
    ticket.assignedTechnicianId ||
    ticket.assigned_technician?.id ||
    ticket.technician?.id ||
    ticket.profiles?.id ||
    "";

  const matchesTechnician =
    !filters.technicianId ||
    String(assignedTechnicianId) ===
      String(filters.technicianId);

  const matchesOverdue =
    !filters.overdueOnly ||
    isTicketOverdue(ticket);

  const matchesEmergency =
    !filters.emergencyOnly ||
    ticket.priority === "EMERGENCY";

  const createdAt = getTimestamp(
    ticket.created_at || ticket.createdAt
  );

  const dateFrom = filters.dateFrom
    ? getTimestamp(`${filters.dateFrom}T00:00:00`)
    : 0;

  const dateTo = filters.dateTo
    ? getTimestamp(`${filters.dateTo}T23:59:59`)
    : 0;

  const matchesDateFrom =
    !dateFrom || createdAt >= dateFrom;

  const matchesDateTo =
    !dateTo || createdAt <= dateTo;

  return (
    matchesSearch &&
    matchesStatus &&
    matchesPriority &&
    matchesLocation &&
    matchesCategory &&
    matchesTechnician &&
    matchesOverdue &&
    matchesEmergency &&
    matchesDateFrom &&
    matchesDateTo
  );
}

function replaceTicket(tickets, updatedTicket) {
  const ticketExists = tickets.some(
    (ticket) =>
      String(ticket.id) ===
      String(updatedTicket.id)
  );

  if (!ticketExists) {
    return [updatedTicket, ...tickets];
  }

  return tickets.map((ticket) =>
    String(ticket.id) ===
    String(updatedTicket.id)
      ? updatedTicket
      : ticket
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
    id: createLocalId("history"),
    action,
    actor_name: actorName || "مستخدم النظام",
    old_status: oldStatus || null,
    new_status: newStatus || null,
    note: note || null,
    created_at: new Date().toISOString(),
  };
}

export function useTickets(
  initialFilters = {},
  options = {}
) {
  const {
    user,
    isTechnician,
  } = useAuth();

  const {
    autoLoad = true,
    assignedToCurrentUser = false,
  } = options;

  const [tickets, setTickets] = useState([]);
  const [filters, setFiltersState] = useState(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }));

  const [loading, setLoading] = useState(
    Boolean(autoLoad)
  );

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const saveTickets = useCallback(
    (nextTickets) => {
      setTickets(nextTickets);

      if (!isSupabaseConfigured) {
        saveStoredTickets(nextTickets);
      }

      return nextTickets;
    },
    []
  );

  const loadTickets = useCallback(
    async (filterOverrides = {}) => {
      const nextFilters = {
        ...filters,
        ...filterOverrides,
      };

      setLoading(true);
      setError("");

      try {
        let loadedTickets;

        if (!isSupabaseConfigured) {
          loadedTickets = readStoredTickets();
        } else {
          const result = await listTickets({
            status: nextFilters.status || undefined,
            priority:
              nextFilters.priority || undefined,
            locationId:
              nextFilters.locationId || undefined,
          });

          loadedTickets =
            normalizeTicketsResult(result);
        }

        const shouldShowAssignedOnly =
          assignedToCurrentUser || isTechnician;

        if (shouldShowAssignedOnly && user?.id) {
          loadedTickets = loadedTickets.filter(
            (ticket) =>
              String(
                ticket.assigned_technician_id ||
                  ticket.assignedTechnicianId ||
                  ""
              ) === String(user.id)
          );
        }

        setTickets(loadedTickets);

        return loadedTickets;
      } catch (loadError) {
        setError(
          normalizeError(
            loadError,
            "تعذر تحميل طلبات الصيانة."
          )
        );

        return [];
      } finally {
        setLoading(false);
      }
    },
    [
      filters,
      assignedToCurrentUser,
      isTechnician,
      user?.id,
    ]
  );

  useEffect(() => {
    if (autoLoad) {
      loadTickets();
    }
  }, [autoLoad, loadTickets]);

  const setFilters = useCallback((nextFilters) => {
    setFiltersState((currentFilters) => ({
      ...currentFilters,
      ...(typeof nextFilters === "function"
        ? nextFilters(currentFilters)
        : nextFilters),
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({
      ...DEFAULT_FILTERS,
      ...initialFilters,
    });
  }, [initialFilters]);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const findTicket = useCallback(
    (ticketId) =>
      tickets.find(
        (ticket) =>
          String(ticket.id) === String(ticketId) ||
          String(getTicketNumber(ticket)) ===
            String(ticketId)
      ) || null,
    [tickets]
  );

  const fetchTicket = useCallback(
    async (ticketId) => {
      if (!ticketId) {
        setError("رقم طلب الصيانة مطلوب.");
        return null;
      }

      setLoading(true);
      setError("");

      try {
        let loadedTicket;

        if (!isSupabaseConfigured) {
          loadedTicket =
            readStoredTickets().find(
              (ticket) =>
                String(ticket.id) ===
                  String(ticketId) ||
                String(getTicketNumber(ticket)) ===
                  String(ticketId)
            ) || null;
        } else {
          const result = await getTicket(ticketId);

          loadedTicket = normalizeTicketResult(
            result,
            null
          );
        }

        if (!loadedTicket) {
          throw new Error(
            "لم يتم العثور على طلب الصيانة."
          );
        }

        setTickets((currentTickets) =>
          replaceTicket(
            currentTickets,
            loadedTicket
          )
        );

        return loadedTicket;
      } catch (fetchError) {
        setError(
          normalizeError(
            fetchError,
            "تعذر تحميل تفاصيل الطلب."
          )
        );

        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createTicket = useCallback(
    async (payload) => {
      setUpdating(true);
      setError("");

      try {
        let createdTicket;

        if (!isSupabaseConfigured) {
          createdTicket = {
            ...payload,
            id: createLocalId("ticket"),
            ticket_number:
              payload.ticket_number ||
              `MT-${new Date().getFullYear()}-${String(
                Date.now()
              ).slice(-6)}`,
            status: payload.status || "NEW",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ticket_history: [
              createHistoryEntry({
                action: "CREATED",
                actorName:
                  user?.full_name ||
                  user?.name ||
                  payload.reporterName ||
                  "المبلّغ",
                newStatus: payload.status || "NEW",
                note: "تم إنشاء طلب الصيانة.",
              }),
            ],
          };
        } else {
          const result =
            await createPublicTicket(payload);

          createdTicket = normalizeTicketResult(
            result,
            null
          );
        }

        if (!createdTicket) {
          throw new Error(
            "لم يتم استلام بيانات الطلب الجديد."
          );
        }

        const nextTickets = [
          createdTicket,
          ...tickets,
        ];

        saveTickets(nextTickets);

        return createdTicket;
      } catch (createError) {
        setError(
          normalizeError(
            createError,
            "تعذر إنشاء طلب الصيانة."
          )
        );

        throw createError;
      } finally {
        setUpdating(false);
      }
    },
    [
      tickets,
      user?.full_name,
      user?.name,
      saveTickets,
    ]
  );

  const updateStatus = useCallback(
    async (ticketOrId, nextStatus, reason = "") => {
      const currentTicket =
        typeof ticketOrId === "object"
          ? ticketOrId
          : findTicket(ticketOrId);

      if (!currentTicket) {
        const notFoundError = new Error(
          "لم يتم العثور على طلب الصيانة."
        );

        setError(notFoundError.message);
        throw notFoundError;
      }

      setUpdating(true);
      setError("");

      try {
        let updatedTicket;

        if (!isSupabaseConfigured) {
          const normalizedReason =
            String(reason || "").trim();

          const historyEntry =
            createHistoryEntry({
              action:
                nextStatus === "CLOSED"
                  ? "CLOSED"
                  : nextStatus ===
                      "PENDING_APPROVAL"
                    ? "COMPLETED"
                    : nextStatus === "IN_PROGRESS"
                      ? "STARTED"
                      : "STATUS_CHANGED",

              actorName:
                user?.full_name ||
                user?.name ||
                "مستخدم النظام",

              oldStatus: currentTicket.status,
              newStatus: nextStatus,
              note: normalizedReason,
            });

          updatedTicket = {
            ...currentTicket,
            status: nextStatus,
            updated_at: new Date().toISOString(),

            started_at:
              nextStatus === "IN_PROGRESS" &&
              !currentTicket.started_at
                ? new Date().toISOString()
                : currentTicket.started_at,

            completed_at:
              nextStatus === "PENDING_APPROVAL"
                ? new Date().toISOString()
                : currentTicket.completed_at,

            closed_at:
              nextStatus === "CLOSED"
                ? new Date().toISOString()
                : currentTicket.closed_at,

            resolution_summary:
              nextStatus === "PENDING_APPROVAL" &&
              normalizedReason
                ? normalizedReason
                : currentTicket.resolution_summary,

            ticket_history: [
              historyEntry,
              ...(currentTicket.ticket_history || []),
            ],
          };
        } else {
          const result = await changeStatus(
            currentTicket,
            nextStatus,
            reason || null
          );

          updatedTicket = {
            ...currentTicket,
            ...normalizeTicketResult(result, {}),
            status: nextStatus,
            updated_at: new Date().toISOString(),
          };
        }

        saveTickets(
          replaceTicket(tickets, updatedTicket)
        );

        return updatedTicket;
      } catch (statusError) {
        setError(
          normalizeError(
            statusError,
            "تعذر تحديث حالة الطلب."
          )
        );

        throw statusError;
      } finally {
        setUpdating(false);
      }
    },
    [
      tickets,
      findTicket,
      saveTickets,
      user?.full_name,
      user?.name,
    ]
  );

  const assign = useCallback(
    async (
      ticketOrId,
      technicianId,
      technician = null
    ) => {
      const currentTicket =
        typeof ticketOrId === "object"
          ? ticketOrId
          : findTicket(ticketOrId);

      if (!currentTicket) {
        const notFoundError = new Error(
          "لم يتم العثور على طلب الصيانة."
        );

        setError(notFoundError.message);
        throw notFoundError;
      }

      if (!technicianId) {
        const technicianError = new Error(
          "يجب اختيار فني الصيانة."
        );

        setError(technicianError.message);
        throw technicianError;
      }

      setUpdating(true);
      setError("");

      try {
        let updatedTicket;

        if (!isSupabaseConfigured) {
          const technicianName =
            technician?.full_name ||
            technician?.fullName ||
            technician?.name ||
            "الفني المحدد";

          updatedTicket = {
            ...currentTicket,
            status: "ASSIGNED",
            assigned_technician_id: technicianId,

            profiles: technician
              ? {
                  id: technicianId,
                  full_name: technicianName,
                  specialization:
                    technician.specialization || null,
                }
              : currentTicket.profiles,

            updated_at: new Date().toISOString(),

            ticket_history: [
              createHistoryEntry({
                action: "ASSIGNED",
                actorName:
                  user?.full_name ||
                  user?.name ||
                  "مشرف الصيانة",
                oldStatus: currentTicket.status,
                newStatus: "ASSIGNED",
                note: `تم تعيين ${technicianName} للطلب.`,
              }),
              ...(currentTicket.ticket_history || []),
            ],
          };
        } else {
          const result = await assignTechnician(
            currentTicket.id,
            technicianId
          );

          updatedTicket = {
            ...currentTicket,
            ...normalizeTicketResult(result, {}),
            status: "ASSIGNED",
            assigned_technician_id: technicianId,
            updated_at: new Date().toISOString(),
          };
        }

        saveTickets(
          replaceTicket(tickets, updatedTicket)
        );

        return updatedTicket;
      } catch (assignError) {
        setError(
          normalizeError(
            assignError,
            "تعذر تعيين الفني."
          )
        );

        throw assignError;
      } finally {
        setUpdating(false);
      }
    },
    [
      tickets,
      findTicket,
      saveTickets,
      user?.full_name,
      user?.name,
    ]
  );

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        matchesFilters(ticket, filters)
      ),
    [tickets, filters]
  );

  const statistics = useMemo(
    () => ({
      total: tickets.length,

      newTickets: tickets.filter(
        (ticket) => ticket.status === "NEW"
      ).length,

      assigned: tickets.filter(
        (ticket) => ticket.status === "ASSIGNED"
      ).length,

      inProgress: tickets.filter((ticket) =>
        [
          "ACCEPTED",
          "IN_PROGRESS",
          "WAITING_PARTS",
          "REOPENED",
        ].includes(ticket.status)
      ).length,

      pendingApproval: tickets.filter(
        (ticket) =>
          ticket.status === "PENDING_APPROVAL"
      ).length,

      closed: tickets.filter(
        (ticket) => ticket.status === "CLOSED"
      ).length,

      overdue: tickets.filter(isTicketOverdue).length,

      emergency: tickets.filter(
        (ticket) =>
          ticket.priority === "EMERGENCY" &&
          !["CLOSED", "CANCELLED"].includes(
            ticket.status
          )
      ).length,
    }),
    [tickets]
  );

  return {
    tickets,
    filteredTickets,
    filters,
    statistics,

    loading,
    updating,
    error,

    setFilters,
    resetFilters,
    clearError,

    loadTickets,
    refresh: loadTickets,
    fetchTicket,
    findTicket,

    createTicket,
    updateStatus,
    assign,

    setTickets: saveTickets,
    isTicketOverdue,
  };
}

export default useTickets;
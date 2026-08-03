export const TICKET_STATUS = Object.freeze({
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_PARTS: "WAITING_PARTS",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED",
  CANCELLED: "CANCELLED",
});

export const STATUS_LABELS = Object.freeze({
  NEW: "جديد",
  ASSIGNED: "تم التعيين",
  ACCEPTED: "مقبول",
  IN_PROGRESS: "جاري العمل",
  WAITING_PARTS: "بانتظار قطعة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  CLOSED: "مغلق",
  REOPENED: "أعيد فتحه",
  CANCELLED: "ملغي",
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateTicketInput(input) {
  const errors = {};
  if (!input?.assetId) errors.assetId = "الأصل مطلوب.";
  if (!input?.description?.trim() || input.description.trim().length < 10) errors.description = "الوصف يجب ألا يقل عن 10 أحرف.";
  if (!["LOW", "MEDIUM", "HIGH", "EMERGENCY"].includes(input?.priority)) errors.priority = "الأولوية غير صحيحة.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateImage(file) {
  if (!file) return { valid: true };
  if (!IMAGE_TYPES.has(file.type)) return { valid: false, error: "يسمح بصور JPG وPNG وWebP فقط." };
  if (file.size > MAX_IMAGE_SIZE) return { valid: false, error: "حجم الصورة يجب ألا يتجاوز 5MB." };
  return { valid: true };
}

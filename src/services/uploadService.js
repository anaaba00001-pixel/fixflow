import { requireSupabase } from "../lib/supabase";

export const STORAGE_BUCKETS = Object.freeze({
  TICKET_ATTACHMENTS: "ticket-attachments",
  ASSET_IMAGES: "asset-images",
  PROFILE_IMAGES: "profile-images",
  REPORTS: "reports",
});

const DEFAULT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const DEFAULT_MAX_FILE_SIZE =
  5 * 1024 * 1024;

function cleanString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizePath(path) {
  return cleanString(path)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

function sanitizeFileName(fileName) {
  const normalizedName = cleanString(fileName)
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedName || "file";
}

function getFileExtension(fileName) {
  const normalizedName = cleanString(fileName);
  const lastDotIndex = normalizedName.lastIndexOf(".");

  if (
    lastDotIndex === -1 ||
    lastDotIndex === normalizedName.length - 1
  ) {
    return "";
  }

  return normalizedName
    .slice(lastDotIndex + 1)
    .toLowerCase();
}

function createUniqueId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isFileObject(value) {
  if (!value) {
    return false;
  }

  if (
    typeof File !== "undefined" &&
    value instanceof File
  ) {
    return true;
  }

  return (
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.type === "string"
  );
}

function formatMaximumSize(bytes) {
  const megabytes = bytes / (1024 * 1024);

  return Number.isInteger(megabytes)
    ? `${megabytes}MB`
    : `${megabytes.toFixed(1)}MB`;
}

function validateFile(
  file,
  options = {}
) {
  if (!isFileObject(file)) {
    throw new Error("يجب اختيار ملف صالح.");
  }

  const allowedTypes =
    options.allowedTypes ||
    DEFAULT_ALLOWED_TYPES;

  const maximumSize =
    Number(options.maximumSize) ||
    DEFAULT_MAX_FILE_SIZE;

  if (file.size <= 0) {
    throw new Error("الملف المحدد فارغ.");
  }

  if (file.size > maximumSize) {
    throw new Error(
      `حجم الملف يجب ألا يتجاوز ${formatMaximumSize(
        maximumSize
      )}.`
    );
  }

  if (
    Array.isArray(allowedTypes) &&
    allowedTypes.length > 0 &&
    !allowedTypes.includes(file.type)
  ) {
    throw new Error(
      "نوع الملف غير مسموح. الأنواع المتاحة هي الصور وملفات PDF."
    );
  }

  return true;
}

function createFilePath(
  file,
  options = {}
) {
  const folder = normalizePath(
    options.folder || "general"
  );

  const originalName = sanitizeFileName(
    file.name
  );

  const extension =
    getFileExtension(originalName);

  const baseName = extension
    ? originalName.slice(
        0,
        -(extension.length + 1)
      )
    : originalName;

  const generatedName = [
    Date.now(),
    createUniqueId(),
    baseName.slice(0, 80),
  ]
    .filter(Boolean)
    .join("-");

  const finalName = extension
    ? `${generatedName}.${extension}`
    : generatedName;

  return folder
    ? `${folder}/${finalName}`
    : finalName;
}

function enhanceUploadError(error) {
  const message = String(
    error?.message ||
      error?.details ||
      error?.error ||
      ""
  ).toLowerCase();

  if (
    message.includes("bucket not found") ||
    message.includes(
      "the resource was not found"
    )
  ) {
    return new Error(
      "مجلد التخزين غير موجود في Supabase."
    );
  }

  if (
    message.includes("duplicate") ||
    message.includes("already exists")
  ) {
    return new Error(
      "يوجد ملف آخر بالاسم نفسه."
    );
  }

  if (
    error?.statusCode === "413" ||
    error?.status === 413 ||
    message.includes("payload too large")
  ) {
    return new Error(
      "حجم الملف أكبر من الحد المسموح."
    );
  }

  if (
    error?.statusCode === "403" ||
    error?.status === 403 ||
    message.includes("permission") ||
    message.includes("row-level security") ||
    message.includes("unauthorized")
  ) {
    return new Error(
      "لا تملكين صلاحية رفع أو حذف هذا الملف."
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
        "حدث خطأ أثناء معالجة الملف."
      );
}

function getPublicFileUrl(
  bucketName,
  filePath
) {
  const { data } = requireSupabase()
    .storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return data?.publicUrl || "";
}

export async function uploadFile(
  file,
  options = {}
) {
  validateFile(file, options);

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const filePath = normalizePath(
    options.filePath ||
      options.path ||
      createFilePath(file, options)
  );

  if (!bucketName) {
    throw new Error(
      "اسم مجلد التخزين مطلوب."
    );
  }

  if (!filePath) {
    throw new Error(
      "مسار حفظ الملف مطلوب."
    );
  }

  const uploadOptions = {
    cacheControl: String(
      options.cacheControl || "3600"
    ),

    upsert: options.upsert === true,

    contentType:
      options.contentType ||
      file.type ||
      undefined,
  };

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .upload(
        filePath,
        file,
        uploadOptions
      );

  if (error) {
    throw enhanceUploadError(error);
  }

  const publicUrl =
    options.public === false
      ? ""
      : getPublicFileUrl(
          bucketName,
          data?.path || filePath
        );

  return {
    bucketName,
    bucket: bucketName,

    path: data?.path || filePath,
    fullPath:
      data?.fullPath ||
      `${bucketName}/${data?.path || filePath}`,

    publicUrl,
    url: publicUrl,

    originalName: file.name,
    fileName:
      data?.path?.split("/").pop() ||
      filePath.split("/").pop(),

    mimeType: file.type,
    size: file.size,
  };
}

export async function uploadFiles(
  files,
  options = {}
) {
  const normalizedFiles = Array.from(
    files || []
  );

  if (normalizedFiles.length === 0) {
    throw new Error(
      "يجب اختيار ملف واحد على الأقل."
    );
  }

  const maximumFiles =
    Number(options.maximumFiles) || 10;

  if (
    normalizedFiles.length >
    maximumFiles
  ) {
    throw new Error(
      `يمكن رفع ${maximumFiles} ملفات كحد أقصى.`
    );
  }

  const results = [];
  const failedUploads = [];

  for (const file of normalizedFiles) {
    try {
      const uploadedFile =
        await uploadFile(file, options);

      results.push(uploadedFile);
    } catch (error) {
      failedUploads.push({
        fileName: file?.name || "ملف",
        error: enhanceUploadError(error),
      });

      if (options.continueOnError !== true) {
        if (
          options.removeUploadedOnError !==
          false
        ) {
          await Promise.allSettled(
            results.map((uploadedFile) =>
              deleteFile(
                uploadedFile.path,
                {
                  bucketName:
                    uploadedFile.bucketName,
                }
              )
            )
          );
        }

        throw enhanceUploadError(error);
      }
    }
  }

  return {
    files: results,
    uploadedFiles: results,
    failedUploads,
    successCount: results.length,
    failedCount: failedUploads.length,
  };
}

export async function uploadTicketAttachment(
  ticketId,
  file,
  options = {}
) {
  if (!ticketId) {
    throw new Error(
      "معرّف طلب الصيانة مطلوب."
    );
  }

  const client = requireSupabase();
  const { data: ticket, error: ticketError } =
    await client
      .from("tickets")
      .select("organization_id")
      .eq("id", ticketId)
      .single();

  if (ticketError || !ticket) {
    throw enhanceUploadError(ticketError);
  }

  const uploadResult = await uploadFile(
    file,
    {
      ...options,

      bucketName:
        options.bucketName ||
        STORAGE_BUCKETS.TICKET_ATTACHMENTS,

      folder:
        options.folder ||
        `${ticket.organization_id}/${ticketId}`,
    }
  );

  if (options.saveRecord === false) {
    return uploadResult;
  }

  try {
    const { data: authData } =
      await requireSupabase()
        .auth
        .getUser();

    const requestedType = String(
      options.attachmentType ||
        options.attachment_type ||
        "REPORT"
    ).toUpperCase();
    const attachmentType = [
      "REPORT",
      "BEFORE_REPAIR",
      "AFTER_REPAIR",
    ].includes(requestedType)
      ? requestedType
      : "REPORT";

    const { data, error } =
      await client
        .from("ticket_attachments")
        .insert({
          organization_id:
            ticket.organization_id,
          ticket_id: ticketId,
          type: attachmentType,
          storage_path: uploadResult.path,
          mime_type: file.type,
          size_bytes: file.size,

          uploaded_by:
            options.uploadedBy ||
            options.uploaded_by ||
            authData?.user?.id ||
            null,
        })
        .select("*")
        .single();

    if (error) {
      await deleteFile(
        uploadResult.path,
        {
          bucketName:
            uploadResult.bucketName,
        }
      );

      throw error;
    }

    return {
      ...uploadResult,
      attachment: data,
    };
  } catch (error) {
    throw enhanceUploadError(error);
  }
}

export async function uploadAssetImage(
  assetId,
  file,
  options = {}
) {
  if (!assetId) {
    throw new Error(
      "معرّف الجهاز مطلوب."
    );
  }

  return uploadFile(file, {
    ...options,

    bucketName:
      options.bucketName ||
      STORAGE_BUCKETS.ASSET_IMAGES,

    folder:
      options.folder ||
      `assets/${assetId}`,

    allowedTypes:
      options.allowedTypes || [
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
  });
}

export async function uploadProfileImage(
  userId,
  file,
  options = {}
) {
  if (!userId) {
    throw new Error(
      "معرّف المستخدم مطلوب."
    );
  }

  return uploadFile(file, {
    ...options,

    bucketName:
      options.bucketName ||
      STORAGE_BUCKETS.PROFILE_IMAGES,

    folder:
      options.folder ||
      `profiles/${userId}`,

    allowedTypes:
      options.allowedTypes || [
        "image/jpeg",
        "image/png",
        "image/webp",
      ],

    maximumSize:
      options.maximumSize ||
      3 * 1024 * 1024,

    upsert:
      options.upsert ?? true,
  });
}

export async function deleteFile(
  filePath,
  options = {}
) {
  const normalizedFilePath =
    normalizePath(filePath);

  if (!normalizedFilePath) {
    throw new Error(
      "مسار الملف المطلوب حذفه غير صحيح."
    );
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .remove([normalizedFilePath]);

  if (error) {
    throw enhanceUploadError(error);
  }

  return {
    success: true,
    deletedFiles: data || [],
    path: normalizedFilePath,
    bucketName,
  };
}

export async function deleteFiles(
  filePaths,
  options = {}
) {
  const normalizedPaths = Array.from(
    filePaths || []
  )
    .map(normalizePath)
    .filter(Boolean);

  if (normalizedPaths.length === 0) {
    throw new Error(
      "يجب تحديد ملف واحد على الأقل للحذف."
    );
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .remove(normalizedPaths);

  if (error) {
    throw enhanceUploadError(error);
  }

  return {
    success: true,
    deletedFiles: data || [],
    paths: normalizedPaths,
    bucketName,
  };
}

export async function deleteTicketAttachment(
  attachment,
  options = {}
) {
  const attachmentId =
    attachment?.id ||
    options.attachmentId;

  const filePath =
    attachment?.storage_path ||
    attachment?.file_path ||
    attachment?.filePath ||
    attachment?.path ||
    options.filePath;

  const bucketName =
    options.bucketName ||
    attachment?.bucket_name ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  if (!attachmentId && !filePath) {
    throw new Error(
      "بيانات المرفق غير مكتملة."
    );
  }

  if (filePath) {
    await deleteFile(filePath, {
      bucketName,
    });
  }

  if (attachmentId) {
    const { error } =
      await requireSupabase()
        .from("ticket_attachments")
        .delete()
        .eq("id", attachmentId);

    if (error) {
      throw enhanceUploadError(error);
    }
  }

  return true;
}

export function getPublicUrl(
  filePath,
  options = {}
) {
  const normalizedFilePath =
    normalizePath(filePath);

  if (!normalizedFilePath) {
    return "";
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  return getPublicFileUrl(
    bucketName,
    normalizedFilePath
  );
}

export async function createSignedUrl(
  filePath,
  options = {}
) {
  const normalizedFilePath =
    normalizePath(filePath);

  if (!normalizedFilePath) {
    throw new Error(
      "مسار الملف مطلوب."
    );
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const expiresIn =
    Number(options.expiresIn) || 3600;

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .createSignedUrl(
        normalizedFilePath,
        expiresIn,
        options.transform
          ? {
              transform:
                options.transform,
            }
          : undefined
      );

  if (error) {
    throw enhanceUploadError(error);
  }

  return {
    signedUrl: data?.signedUrl || "",
    url: data?.signedUrl || "",
    path: data?.path || normalizedFilePath,
    expiresIn,
  };
}

export async function downloadFile(
  filePath,
  options = {}
) {
  const normalizedFilePath =
    normalizePath(filePath);

  if (!normalizedFilePath) {
    throw new Error(
      "مسار الملف المطلوب تنزيله غير صحيح."
    );
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .download(normalizedFilePath);

  if (error) {
    throw enhanceUploadError(error);
  }

  if (
    options.triggerDownload !== false &&
    typeof document !== "undefined"
  ) {
    const fileUrl =
      URL.createObjectURL(data);

    const anchor =
      document.createElement("a");

    anchor.href = fileUrl;

    anchor.download =
      options.fileName ||
      normalizedFilePath
        .split("/")
        .pop() ||
      "file";

    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(fileUrl);
  }

  return data;
}

export async function listFiles(
  folder = "",
  options = {}
) {
  const normalizedFolder =
    normalizePath(folder);

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const limit = Math.min(
    Math.max(
      Number(options.limit) || 100,
      1
    ),
    1000
  );

  const offset = Math.max(
    Number(options.offset) || 0,
    0
  );

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .list(normalizedFolder, {
        limit,
        offset,

        sortBy: {
          column:
            options.sortColumn ||
            "created_at",

          order:
            options.sortOrder ||
            "desc",
        },

        search:
          cleanString(options.search) ||
          undefined,
      });

  if (error) {
    throw enhanceUploadError(error);
  }

  return (data || []).map((file) => {
    const path = normalizedFolder
      ? `${normalizedFolder}/${file.name}`
      : file.name;

    return {
      ...file,
      path,
      publicUrl:
        options.includePublicUrl === false
          ? ""
          : getPublicFileUrl(
              bucketName,
              path
            ),
    };
  });
}

export async function moveFile(
  sourcePath,
  destinationPath,
  options = {}
) {
  const normalizedSource =
    normalizePath(sourcePath);

  const normalizedDestination =
    normalizePath(destinationPath);

  if (
    !normalizedSource ||
    !normalizedDestination
  ) {
    throw new Error(
      "مسار الملف القديم والجديد مطلوبان."
    );
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .move(
        normalizedSource,
        normalizedDestination
      );

  if (error) {
    throw enhanceUploadError(error);
  }

  return {
    data,
    sourcePath: normalizedSource,
    destinationPath:
      normalizedDestination,

    publicUrl: getPublicFileUrl(
      bucketName,
      normalizedDestination
    ),
  };
}

export async function copyFile(
  sourcePath,
  destinationPath,
  options = {}
) {
  const normalizedSource =
    normalizePath(sourcePath);

  const normalizedDestination =
    normalizePath(destinationPath);

  if (
    !normalizedSource ||
    !normalizedDestination
  ) {
    throw new Error(
      "مسار الملف الأصلي والمسار الجديد مطلوبان."
    );
  }

  const bucketName =
    options.bucketName ||
    options.bucket ||
    STORAGE_BUCKETS.TICKET_ATTACHMENTS;

  const { data, error } =
    await requireSupabase()
      .storage
      .from(bucketName)
      .copy(
        normalizedSource,
        normalizedDestination
      );

  if (error) {
    throw enhanceUploadError(error);
  }

  return {
    data,
    sourcePath: normalizedSource,
    destinationPath:
      normalizedDestination,

    publicUrl: getPublicFileUrl(
      bucketName,
      normalizedDestination
    ),
  };
}

export const uploadAttachment =
  uploadTicketAttachment;

export const removeFile = deleteFile;

export const removeFiles = deleteFiles;

export const getSignedUrl =
  createSignedUrl;

export const fetchFiles = listFiles;

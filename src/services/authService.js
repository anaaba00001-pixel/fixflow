import {
  isSupabaseConfigured,
  requireSupabase,
} from "../lib/supabase";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getApplicationUrl() {
  const configuredUrl =
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_PUBLIC_APP_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

function getPasswordResetRedirectUrl() {
  const configuredUrl =
    import.meta.env.VITE_PASSWORD_RESET_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  return `${getApplicationUrl()}/login?mode=reset-password`;
}

function validateEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error(
      "يرجى إدخال البريد الإلكتروني."
    );
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error(
      "صيغة البريد الإلكتروني غير صحيحة."
    );
  }

  return normalizedEmail;
}

function validatePassword(
  password,
  {
    minimumLength = 8,
    requireStrength = false,
  } = {}
) {
  const normalizedPassword = String(
    password || ""
  );

  if (!normalizedPassword) {
    throw new Error("يرجى إدخال كلمة المرور.");
  }

  if (normalizedPassword.length < minimumLength) {
    throw new Error(
      `كلمة المرور يجب ألا تقل عن ${minimumLength} أحرف.`
    );
  }

  if (requireStrength) {
    const hasLowercase =
      /[a-z]/.test(normalizedPassword);

    const hasUppercase =
      /[A-Z]/.test(normalizedPassword);

    const hasNumber =
      /\d/.test(normalizedPassword);

    const hasSymbol =
      /[^A-Za-z0-9]/.test(normalizedPassword);

    if (
      !hasLowercase ||
      !hasUppercase ||
      !hasNumber ||
      !hasSymbol
    ) {
      throw new Error(
        "كلمة المرور يجب أن تحتوي على حرف كبير وحرف صغير ورقم ورمز."
      );
    }
  }

  return normalizedPassword;
}

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "يجب ربط المشروع بـ Supabase لاستخدام تسجيل الدخول الحقيقي."
    );
  }

  return requireSupabase();
}

function enhanceAuthError(error) {
  const message = String(
    error?.message || error?.error_description || ""
  ).toLowerCase();

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return new Error(
      "البريد الإلكتروني أو كلمة المرور غير صحيحة."
    );
  }

  if (
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed")
  ) {
    return new Error(
      "يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول."
    );
  }

  if (
    message.includes("user not found") ||
    message.includes("user_not_found")
  ) {
    return new Error(
      "لم يتم العثور على حساب مرتبط بهذا البريد."
    );
  }

  if (
    message.includes("user already registered") ||
    message.includes("already been registered")
  ) {
    return new Error(
      "يوجد حساب مسجل بهذا البريد الإلكتروني."
    );
  }

  if (
    message.includes("password should be") ||
    message.includes("weak password")
  ) {
    return new Error(
      "كلمة المرور لا تحقق متطلبات الأمان."
    );
  }

  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    error?.status === 429
  ) {
    return new Error(
      "تم تنفيذ محاولات كثيرة خلال وقت قصير. انتظري قليلًا ثم حاولي مرة أخرى."
    );
  }

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed")
  ) {
    return new Error(
      "تعذر الاتصال بالخادم. تحققي من اتصال الإنترنت."
    );
  }

  if (
    message.includes("session") &&
    message.includes("missing")
  ) {
    return new Error(
      "انتهت جلسة تسجيل الدخول. سجّلي الدخول مرة أخرى."
    );
  }

  if (
    message.includes("same password") ||
    message.includes(
      "new password should be different"
    )
  ) {
    return new Error(
      "يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية."
    );
  }

  return error instanceof Error
    ? error
    : new Error(
        "حدث خطأ أثناء تنفيذ عملية تسجيل الدخول."
      );
}

export async function getUserProfile(userId) {
  if (!userId) {
    throw new Error("معرّف المستخدم مطلوب.");
  }

  const supabase = ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    const message = String(
      error.message || ""
    ).toLowerCase();

    if (
      error.code === "PGRST116" ||
      message.includes("no rows")
    ) {
      throw new Error(
        "لم يتم العثور على ملف المستخدم."
      );
    }

    throw enhanceAuthError(error);
  }

  return data;
}

export async function signIn(email, password) {
  const normalizedEmail = validateEmail(email);

  const normalizedPassword = validatePassword(
    password,
    {
      minimumLength: 1,
    }
  );

  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

    if (error) {
      throw error;
    }

    if (!data?.user || !data?.session) {
      throw new Error(
        "لم يتم إنشاء جلسة تسجيل الدخول."
      );
    }

    let profile;

    try {
      profile = await getUserProfile(data.user.id);
    } catch (profileError) {
      await supabase.auth.signOut();

      throw profileError;
    }

    if (profile?.is_active === false) {
      await supabase.auth.signOut();

      throw new Error(
        "هذا الحساب معطل. تواصلي مع مدير المنشأة."
      );
    }

    return {
      user: profile,
      profile,
      authUser: data.user,
      session: data.session,
    };
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function signOut(options = {}) {
  const supabase = ensureSupabaseConfigured();

  const scope = options.scope || "local";

  try {
    const { error } = await supabase.auth.signOut({
      scope,
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function resetPassword(email) {
  const normalizedEmail = validateEmail(email);
  const supabase = ensureSupabaseConfigured();

  try {
    const { error } =
      await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo:
            getPasswordResetRedirectUrl(),
        }
      );

    if (error) {
      throw error;
    }

    return {
      success: true,
      email: normalizedEmail,
    };
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function updatePassword(
  newPassword
) {
  const normalizedPassword = validatePassword(
    newPassword,
    {
      minimumLength: 8,
      requireStrength: true,
    }
  );

  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.updateUser({
        password: normalizedPassword,
      });

    if (error) {
      throw error;
    }

    return data?.user || null;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function updateEmail(newEmail) {
  const normalizedEmail =
    validateEmail(newEmail);

  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.updateUser({
        email: normalizedEmail,
      });

    if (error) {
      throw error;
    }

    return data?.user || null;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function getSession() {
  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data?.session || null;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function getCurrentAuthUser() {
  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return data?.user || null;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function getCurrentUserProfile() {
  const authUser = await getCurrentAuthUser();

  if (!authUser?.id) {
    return null;
  }

  return getUserProfile(authUser.id);
}

export async function refreshSession() {
  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }

    return data?.session || null;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function resendConfirmationEmail(
  email
) {
  const normalizedEmail = validateEmail(email);
  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: getApplicationUrl(),
        },
      });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export async function verifyOtp({
  email,
  token,
  type = "email",
}) {
  const normalizedEmail = validateEmail(email);
  const normalizedToken = String(
    token || ""
  ).trim();

  if (!normalizedToken) {
    throw new Error("رمز التحقق مطلوب.");
  }

  const supabase = ensureSupabaseConfigured();

  try {
    const { data, error } =
      await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type,
      });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw enhanceAuthError(error);
  }
}

export function onAuthStateChange(callback) {
  if (typeof callback !== "function") {
    throw new Error(
      "يجب تمرير دالة لمعالجة تغير حالة تسجيل الدخول."
    );
  }

  const supabase = ensureSupabaseConfigured();

  const { data } =
    supabase.auth.onAuthStateChange(
      (event, session) => {
        callback({
          event,
          session,
          authUser: session?.user || null,
        });
      }
    );

  return () => {
    data?.subscription?.unsubscribe();
  };
}

export const login = signIn;
export const logout = signOut;
export const requestPasswordReset =
  resetPassword;
export const changePassword =
  updatePassword;
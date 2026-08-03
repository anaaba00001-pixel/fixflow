import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  isSupabaseConfigured,
  supabase,
} from "../lib/supabase";

/* ==================================================
   حسابات العرض التجريبية
================================================== */

const DEMO_USERS = Object.freeze({
  "platform@fixflow.demo": {
    id: "demo-platform-admin",
    email: "platform@fixflow.demo",
    full_name: "مدير المنصة",
    phone: "0500000001",
    role: "PLATFORM_ADMIN",
    organization_id: null,
    location_ids: [],
    is_active: true,
  },

  "admin@fixflow.demo": {
    id: "demo-organization-admin",
    email: "admin@fixflow.demo",
    full_name: "نورة الناصر",
    phone: "0500000002",
    role: "ORGANIZATION_ADMIN",
    organization_id: "demo-organization",
    location_ids: [],
    is_active: true,
  },

  "branch@fixflow.demo": {
    id: "demo-branch-manager",
    email: "branch@fixflow.demo",
    full_name: "خالد الشمري",
    phone: "0500000003",
    role: "BRANCH_MANAGER",
    organization_id: "demo-organization",
    location_id: "demo-location-riyadh",
    location_ids: [
      "demo-location-riyadh",
    ],
    is_active: true,
  },

  "supervisor@fixflow.demo": {
    id: "demo-supervisor",
    email: "supervisor@fixflow.demo",
    full_name: "سارة العتيبي",
    phone: "0500000004",
    role: "SUPERVISOR",
    organization_id: "demo-organization",
    location_ids: [
      "demo-location-riyadh",
      "demo-location-north",
    ],
    is_active: true,
  },

  "technician@fixflow.demo": {
    id: "technician-1",
    email: "technician@fixflow.demo",
    full_name: "محمد العتيبي",
    phone: "0500000005",
    role: "TECHNICIAN",
    specialization: "تكييف وتبريد",
    availability_status: "AVAILABLE",
    organization_id: "demo-organization",
    location_ids: [
      "demo-location-riyadh",
      "demo-location-north",
    ],
    is_active: true,
  },

  "inventory@fixflow.demo": {
    id: "demo-inventory-manager",
    email: "inventory@fixflow.demo",
    full_name: "أحمد الحربي",
    phone: "0500000006",
    role: "INVENTORY_MANAGER",
    organization_id: "demo-organization",
    location_ids: [],
    is_active: true,
  },

  "reporter@fixflow.demo": {
    id: "reporter-demo",
    email: "reporter@fixflow.demo",
    full_name: "ريم محمد",
    phone: "0500000007",
    role: "REGISTERED_REPORTER",
    organization_id: "demo-organization",
    location_ids: [],
    is_active: true,
  },
});

const DEFAULT_DEMO_EMAIL =
  "admin@fixflow.demo";

const DEMO_SESSION_KEY =
  "fixflow-demo-session";

/* ==================================================
   Context
================================================== */

const AuthContext =
  createContext(null);

/* ==================================================
   دوال مساعدة
================================================== */

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * نسخ بيانات المستخدم؛ حتى لا يتم تعديل
 * البيانات الأصلية داخل DEMO_USERS.
 */
function cloneDemoUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,

    location_ids: Array.isArray(
      user.location_ids
    )
      ? [...user.location_ids]
      : [],
  };
}

/**
 * قراءة جلسة العرض المحفوظة.
 */
function readDemoSession() {
  try {
    const storedValue =
      sessionStorage.getItem(
        DEMO_SESSION_KEY
      );

    if (!storedValue) {
      return null;
    }

    /*
     * دعم النسخة القديمة التي كانت تحفظ:
     * "true"
     */
    if (storedValue === "true") {
      return cloneDemoUser(
        DEMO_USERS[
          DEFAULT_DEMO_EMAIL
        ]
      );
    }

    const parsedValue =
      JSON.parse(storedValue);

    const email = normalizeEmail(
      parsedValue?.email
    );

    if (
      email &&
      DEMO_USERS[email]
    ) {
      return cloneDemoUser(
        DEMO_USERS[email]
      );
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * حفظ حساب العرض الحالي.
 */
function saveDemoSession(user) {
  if (!user?.email) {
    return;
  }

  sessionStorage.setItem(
    DEMO_SESSION_KEY,
    JSON.stringify({
      email: user.email,
    })
  );
}

/**
 * جلب الملف الشخصي من Supabase.
 */
async function fetchProfile(
  userId
) {
  if (!supabase || !userId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

/* ==================================================
   Auth Provider
================================================== */

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(() => {
      if (
        isSupabaseConfigured
      ) {
        return null;
      }

      return readDemoSession();
    });

  const [loading, setLoading] =
    useState(
      isSupabaseConfigured
    );

  /* ==================================================
     متابعة جلسة Supabase
  ================================================== */

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function loadSession() {
      setLoading(true);

      try {
        const {
          data,
          error,
        } =
          await supabase.auth
            .getSession();

        if (error) {
          throw error;
        }

        const authUser =
          data.session?.user;

        if (!authUser) {
          if (isMounted) {
            setUser(null);
          }

          return;
        }

        const profile =
          await fetchProfile(
            authUser.id
          );

        if (!profile) {
          await supabase.auth
            .signOut();

          if (isMounted) {
            setUser(null);
          }

          return;
        }

        if (
          profile.is_active ===
          false
        ) {
          await supabase.auth
            .signOut();

          if (isMounted) {
            setUser(null);
          }

          return;
        }

        if (isMounted) {
          setUser({
            ...profile,

            email:
              profile.email ||
              authUser.email ||
              "",
          });
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: authListener,
    } =
      supabase.auth
        .onAuthStateChange(
          async (
            event,
            session
          ) => {
            if (!isMounted) {
              return;
            }

            if (
              event ===
                "SIGNED_OUT" ||
              !session?.user
            ) {
              setUser(null);
              setLoading(false);
              return;
            }

            try {
              const profile =
                await fetchProfile(
                  session.user.id
                );

              if (
                !profile ||
                profile.is_active ===
                  false
              ) {
                await supabase.auth
                  .signOut();

                setUser(null);
                return;
              }

              setUser({
                ...profile,

                email:
                  profile.email ||
                  session.user
                    .email ||
                  "",
              });
            } catch {
              setUser(null);
            } finally {
              setLoading(false);
            }
          }
        );

    return () => {
      isMounted = false;

      authListener.subscription
        .unsubscribe();
    };
  }, []);

  /* ==================================================
     تسجيل الدخول
  ================================================== */

  async function signIn(
    email,
    password
  ) {
    const normalizedEmail =
      normalizeEmail(email);

    if (!normalizedEmail) {
      throw new Error(
        "البريد الإلكتروني مطلوب."
      );
    }

    if (!password) {
      throw new Error(
        "كلمة المرور مطلوبة."
      );
    }

    /*
     * وضع العرض التجريبي.
     */
    if (!supabase) {
      const selectedDemoUser =
        DEMO_USERS[
          normalizedEmail
        ];

      /*
       * الحسابات المعروفة تعطي الدور الصحيح.
       *
       * أي بريد آخر يحافظ على السلوك القديم:
       * يدخل كمستخدم مدير منشأة تجريبي.
       */
      const demoUser =
        selectedDemoUser
          ? cloneDemoUser(
              selectedDemoUser
            )
          : {
              ...cloneDemoUser(
                DEMO_USERS[
                  DEFAULT_DEMO_EMAIL
                ]
              ),

              id:
                `demo-${Date.now()}`,

              email:
                normalizedEmail,

              full_name:
                normalizedEmail
                  .split("@")[0] ||
                "مستخدم تجريبي",
            };

      saveDemoSession(
        demoUser
      );

      setUser(demoUser);

      return demoUser;
    }

    /*
     * تسجيل الدخول الحقيقي.
     */
    const {
      data,
      error,
    } =
      await supabase.auth
        .signInWithPassword({
          email:
            normalizedEmail,

          password,
        });

    if (error) {
      throw error;
    }

    const authUser =
      data.user ||
      data.session?.user;

    if (!authUser) {
      throw new Error(
        "تعذر قراءة بيانات الحساب."
      );
    }

    const profile =
      await fetchProfile(
        authUser.id
      );

    if (
      !profile ||
      profile.is_active === false
    ) {
      await supabase.auth
        .signOut();

      throw new Error(
        "الحساب غير متاح."
      );
    }

    const authenticatedUser = {
      ...profile,

      email:
        profile.email ||
        authUser.email ||
        normalizedEmail,
    };

    setUser(
      authenticatedUser
    );

    return authenticatedUser;
  }

  /* ==================================================
     تحديث بيانات المستخدم
  ================================================== */

  async function refreshProfile() {
    if (!user?.id) {
      return null;
    }

    if (!supabase) {
      const demoUser =
        DEMO_USERS[
          normalizeEmail(
            user.email
          )
        ];

      if (demoUser) {
        const refreshedUser =
          cloneDemoUser(
            demoUser
          );

        setUser(
          refreshedUser
        );

        saveDemoSession(
          refreshedUser
        );

        return refreshedUser;
      }

      return user;
    }

    const profile =
      await fetchProfile(
        user.id
      );

    if (
      !profile ||
      profile.is_active === false
    ) {
      await signOut();
      return null;
    }

    const refreshedUser = {
      ...profile,

      email:
        profile.email ||
        user.email ||
        "",
    };

    setUser(
      refreshedUser
    );

    return refreshedUser;
  }

  /* ==================================================
     تسجيل الخروج
  ================================================== */

  async function signOut() {
    sessionStorage.removeItem(
      DEMO_SESSION_KEY
    );

    if (supabase) {
      const { error } =
        await supabase.auth
          .signOut();

      if (error) {
        throw error;
      }
    }

    setUser(null);
  }

  /* ==================================================
     القيمة التي تصل إلى بقية التطبيق
  ================================================== */

  const value = useMemo(
    () => ({
      user,
      profile: user,

      loading,

      signIn,
      signOut,
      refreshProfile,

      isDemo:
        !isSupabaseConfigured,
    }),
    [
      user,
      loading,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ==================================================
   Hook المصادقة الأصلي
================================================== */

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}

export default AuthContext;
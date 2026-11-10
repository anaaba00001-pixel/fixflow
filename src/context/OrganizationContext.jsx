import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

import {
  isSupabaseConfigured,
  requireSupabase,
} from "../lib/supabase";
import { readWorkspace } from "../lib/localData";

/* ==================================================
   Context
================================================== */

const OrganizationContext =
  createContext(null);

/* ==================================================
   بيانات المنشأة التجريبية
================================================== */

const DEMO_ORGANIZATION = Object.freeze({
  id: "demo-organization",
  name: "منشأة FixFlow التجريبية",
  slug: "fixflow-demo",
  status: "ACTIVE",
  logo_path: null,
  timezone: "Asia/Riyadh",
  created_at: null,
  updated_at: null,
});

/* ==================================================
   دوال مساعدة
================================================== */

function normalizeOrganization(
  organization,
  fallbackId = null
) {
  if (!organization && !fallbackId) {
    return null;
  }

  return {
    id:
      organization?.id ||
      fallbackId,

    name:
      organization?.name ||
      "منشأة غير مسماة",

    slug:
      organization?.slug ||
      "",

    status:
      organization?.status ||
      "ACTIVE",

    logo_path:
      organization?.logo_path ||
      organization?.logoPath ||
      null,

    timezone:
      organization?.timezone ||
      "Asia/Riyadh",

    created_at:
      organization?.created_at ||
      organization?.createdAt ||
      null,

    updated_at:
      organization?.updated_at ||
      organization?.updatedAt ||
      null,
  };
}

function createDemoOrganization(
  organizationId
) {
  if (!organizationId) {
    return null;
  }

  return normalizeOrganization(
    {
      ...DEMO_ORGANIZATION,
      id: organizationId,
      name: readWorkspace().name || "منشأتي",
    },
    organizationId
  );
}

/* ==================================================
   Provider
================================================== */

export function OrganizationProvider({
  children,
}) {
  const {
    user,
    loading: authLoading,
    isDemo,
  } = useAuth();

  const organizationId =
    user?.organization_id ||
    user?.organizationId ||
    null;

  const isPlatformAdmin =
    user?.role ===
    "PLATFORM_ADMIN";

  const [
    organization,
    setOrganization,
  ] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ==================================================
     تحميل بيانات المنشأة
  ================================================== */

  const loadOrganization =
    useCallback(async () => {
      if (authLoading) {
        return null;
      }

      setError("");

      /*
       * لا يوجد مستخدم مسجل.
       */
      if (!user) {
        setOrganization(null);
        setLoading(false);

        return null;
      }

      /*
       * مدير المنصة لا يرتبط بمنشأة واحدة.
       */
      if (
        isPlatformAdmin &&
        !organizationId
      ) {
        setOrganization(null);
        setLoading(false);

        return null;
      }

      /*
       * أي مستخدم آخر يجب أن يكون مرتبطًا
       * بمنشأة.
       */
      if (!organizationId) {
        setOrganization(null);

        setError(
          "لا توجد منشأة مرتبطة بالحساب الحالي."
        );

        setLoading(false);

        return null;
      }

      setLoading(true);

      try {
        /*
         * وضع العرض التجريبي.
         */
        if (
          isDemo ||
          !isSupabaseConfigured
        ) {
          const demoOrganization =
            createDemoOrganization(
              organizationId
            );

          setOrganization(
            demoOrganization
          );

          return demoOrganization;
        }

        /*
         * الوضع الحقيقي مع Supabase.
         */
        const {
          data,
          error:
            organizationError,
        } =
          await requireSupabase()
            .from("organizations")
            .select(
              `
                id,
                name,
                slug,
                status,
                logo_path,
                created_at,
                updated_at
              `
            )
            .eq(
              "id",
              organizationId
            )
            .maybeSingle();

        if (organizationError) {
          throw organizationError;
        }

        if (!data) {
          throw new Error(
            "ORGANIZATION_NOT_FOUND"
          );
        }

        const normalizedOrganization =
          normalizeOrganization(
            data,
            organizationId
          );

        setOrganization(
          normalizedOrganization
        );

        return normalizedOrganization;
      } catch (
        organizationError
      ) {
        const message = String(
          organizationError?.message ||
            ""
        ).toUpperCase();

        setOrganization(null);

        if (
          message.includes(
            "ORGANIZATION_NOT_FOUND"
          ) ||
          message.includes(
            "PGRST116"
          )
        ) {
          setError(
            "لم يتم العثور على المنشأة المرتبطة بالحساب."
          );
        } else if (
          message.includes(
            "ROW-LEVEL SECURITY"
          ) ||
          message.includes(
            "42501"
          )
        ) {
          setError(
            "لا تملك صلاحية قراءة بيانات هذه المنشأة."
          );
        } else if (
          message.includes(
            "FAILED TO FETCH"
          ) ||
          message.includes(
            "NETWORK"
          )
        ) {
          setError(
            "تعذر الاتصال بقاعدة البيانات."
          );
        } else {
          setError(
            organizationError instanceof
              Error
              ? organizationError.message
              : "تعذر تحميل بيانات المنشأة."
          );
        }

        return null;
      } finally {
        setLoading(false);
      }
    }, [
      authLoading,
      user?.id,
      organizationId,
      isPlatformAdmin,
      isDemo,
    ]);

  /* ==================================================
     تحديث المنشأة عند تغيير الحساب
  ================================================== */

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  /* ==================================================
     إعادة تحميل المنشأة
  ================================================== */

  const refresh =
    useCallback(async () => {
      return loadOrganization();
    }, [loadOrganization]);

  /* ==================================================
     تحديث المنشأة داخل الواجهة
  ================================================== */

  const updateLocalOrganization =
    useCallback((updates) => {
      setOrganization(
        (currentOrganization) => {
          if (
            !currentOrganization
          ) {
            return null;
          }

          const nextUpdates =
            typeof updates ===
            "function"
              ? updates(
                  currentOrganization
                )
              : updates;

          return normalizeOrganization(
            {
              ...currentOrganization,
              ...(nextUpdates ||
                {}),
            },
            currentOrganization.id
          );
        }
      );
    }, []);

  /* ==================================================
     قيمة Context
  ================================================== */

  const value = useMemo(
    () => ({
      organization,

      organizationId:
        organization?.id ||
        organizationId ||
        null,

      loading:
        authLoading ||
        loading,

      error,

      refresh,

      updateLocalOrganization,

      isPlatformScope:
        isPlatformAdmin &&
        !organizationId,

      hasOrganization:
        Boolean(
          organization?.id
        ),
    }),
    [
      organization,
      organizationId,
      authLoading,
      loading,
      error,
      refresh,
      updateLocalOrganization,
      isPlatformAdmin,
    ]
  );

  return (
    <OrganizationContext.Provider
      value={value}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

/* ==================================================
   استخدام Context
================================================== */

export function useOrganization() {
  const context =
    useContext(
      OrganizationContext
    );

  if (!context) {
    throw new Error(
      "useOrganization must be used inside OrganizationProvider"
    );
  }

  return context;
}

export default OrganizationContext;

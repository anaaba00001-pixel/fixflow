import { useCallback, useMemo } from "react";
import { useOrganization as useOrganizationContext } from "../context/OrganizationContext";

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase();
}

export function useOrganization() {
  const context = useOrganizationContext();

  const {
    organization,
    loading = false,
    error = "",
    refresh,
  } = context;

  const organizationId =
    organization?.id ||
    organization?.organization_id ||
    null;

  const organizationName =
    organization?.name ||
    organization?.organization_name ||
    "";

  const status = normalizeStatus(
    organization?.status
  );

  const timezone =
    organization?.timezone || "Asia/Riyadh";

  const isActive =
    Boolean(organizationId) &&
    (status === "ACTIVE" || !status);

  const isSuspended =
    status === "SUSPENDED";

  const isInactive =
    status === "INACTIVE";

  const hasOrganization = Boolean(
    organizationId
  );

  const belongsToOrganization = useCallback(
    (resource) => {
      if (!resource || !organizationId) {
        return false;
      }

      const resourceOrganizationId =
        resource.organization_id ||
        resource.organizationId ||
        resource.organization?.id ||
        null;

      if (!resourceOrganizationId) {
        return false;
      }

      return (
        String(resourceOrganizationId) ===
        String(organizationId)
      );
    },
    [organizationId]
  );

  const assertOrganizationAccess = useCallback(
    (resource) => {
      if (!hasOrganization) {
        throw new Error(
          "لا توجد منشأة مرتبطة بالحساب الحالي."
        );
      }

      if (!isActive) {
        throw new Error(
          "المنشأة غير نشطة حاليًا."
        );
      }

      if (
        resource &&
        !belongsToOrganization(resource)
      ) {
        throw new Error(
          "لا يمكنك الوصول إلى بيانات منشأة أخرى."
        );
      }

      return true;
    },
    [
      hasOrganization,
      isActive,
      belongsToOrganization,
    ]
  );

  const refreshOrganization =
    useCallback(async () => {
      if (typeof refresh === "function") {
        return refresh();
      }

      return organization;
    }, [refresh, organization]);

  return useMemo(
    () => ({
      ...context,

      organization,
      organizationId,
      organizationName,
      status,
      timezone,

      loading,
      error,

      hasOrganization,
      isActive,
      isInactive,
      isSuspended,

      belongsToOrganization,
      assertOrganizationAccess,
      refreshOrganization,
    }),
    [
      context,
      organization,
      organizationId,
      organizationName,
      status,
      timezone,
      loading,
      error,
      hasOrganization,
      isActive,
      isInactive,
      isSuspended,
      belongsToOrganization,
      assertOrganizationAccess,
      refreshOrganization,
    ]
  );
}

export default useOrganization;

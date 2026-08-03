import { useMemo, useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

import {
  ROLE,
  ROLE_LABELS,
} from "../../constants/roles";

const AVAILABILITY_OPTIONS = [
  {
    value: "AVAILABLE",
    label: "متاح",
  },
  {
    value: "BUSY",
    label: "مشغول",
  },
  {
    value: "OFF_DUTY",
    label: "خارج الدوام",
  },
];

const ROLE_DESCRIPTIONS = {
  [ROLE.PLATFORM_ADMIN]:
    "يدير المنصة وجميع المنشآت ولا يرتبط بفرع محدد.",

  [ROLE.ORGANIZATION_ADMIN]:
    "يدير المنشأة وفروعها ومستخدميها وتقاريرها.",

  [ROLE.BRANCH_MANAGER]:
    "يدير فرعًا واحدًا ويشاهد بياناته وطلباته فقط.",

  [ROLE.SUPERVISOR]:
    "يدير أعمال الصيانة في فرع واحد أو عدة فروع.",

  [ROLE.TECHNICIAN]:
    "ينفذ مهام الصيانة المسندة إليه ضمن الفروع المسموحة.",

  [ROLE.INVENTORY_MANAGER]:
    "يتابع الأصول وقطع الغيار والمخزون داخل المنشأة.",

  [ROLE.REGISTERED_REPORTER]:
    "ينشئ البلاغات ويتابع بلاغاته المسجلة فقط.",
};

function normalizeLocation(location) {
  if (typeof location === "string") {
    return {
      id: location,
      name: location,
      isActive: true,
    };
  }

  return {
    id:
      location?.id ??
      location?.value ??
      "",

    name:
      location?.name ??
      location?.label ??
      "موقع دون اسم",

    isActive:
      location?.is_active ??
      location?.isActive ??
      !location?.disabled,
  };
}

function getInitialLocationIds(
  initialValues
) {
  const locations =
    initialValues.locationIds ??
    initialValues.location_ids ??
    initialValues.user_locations ??
    initialValues.locations ??
    [];

  if (!Array.isArray(locations)) {
    return [];
  }

  return locations
    .map((location) => {
      if (
        typeof location ===
        "string"
      ) {
        return location;
      }

      return (
        location?.location_id ??
        location?.locationId ??
        location?.locations?.id ??
        location?.location?.id ??
        location?.id ??
        null
      );
    })
    .filter(Boolean)
    .map(String);
}

function normalizePhone(value) {
  return String(value || "").trim();
}

function isValidPhone(phone) {
  if (!phone) {
    return true;
  }

  const digits =
    phone.replace(/\D/g, "");

  return (
    digits.length >= 8 &&
    digits.length <= 15
  );
}

function getLocationRule(role) {
  if (
    role ===
    ROLE.BRANCH_MANAGER
  ) {
    return {
      required: true,
      multiple: false,
      minimum: 1,
      maximum: 1,

      title:
        "الفرع المسؤول عنه",

      hint:
        "يجب ربط مدير الفرع بفرع واحد فقط.",
    };
  }

  if (
    role === ROLE.SUPERVISOR ||
    role === ROLE.TECHNICIAN
  ) {
    return {
      required: true,
      multiple: true,
      minimum: 1,
      maximum: null,

      title:
        "الفروع المسموحة",

      hint:
        role === ROLE.SUPERVISOR
          ? "يمكن ربط المشرف بفرع واحد أو عدة فروع."
          : "سيشاهد الفني المهام التابعة للفروع المحددة.",
    };
  }

  return {
    required: false,
    multiple: false,
    minimum: 0,
    maximum: 0,

    title:
      "الفروع المسموحة",

    hint:
      "هذا الدور لا يحتاج إلى ربط مباشر بفرع.",
  };
}

export default function UserForm({
  locations = [],

  initialValues = {},

  allowedRoles = [
    ROLE.ORGANIZATION_ADMIN,
    ROLE.BRANCH_MANAGER,
    ROLE.SUPERVISOR,
    ROLE.TECHNICIAN,
    ROLE.INVENTORY_MANAGER,
    ROLE.REGISTERED_REPORTER,
  ],

  busy = false,

  error = "",

  submitText =
    "حفظ المستخدم",

  editMode = false,

  onSubmit,

  onCancel,
}) {
  const initialRole =
    initialValues.role ??
    allowedRoles[0] ??
    ROLE.TECHNICIAN;

  const [role, setRole] =
    useState(initialRole);

  const [
    locationIds,
    setLocationIds,
  ] = useState(() =>
    getInitialLocationIds(
      initialValues
    )
  );

  const [
    availability,
    setAvailability,
  ] = useState(
    initialValues
      .availability_status ??
      initialValues
        .availabilityStatus ??
      "AVAILABLE"
  );

  const [
    isActive,
    setIsActive,
  ] = useState(
    initialValues.is_active ??
      initialValues.isActive ??
      true
  );

  const [
    sendInviteNow,
    setSendInviteNow,
  ] = useState(
    initialValues.sendInviteNow ??
      initialValues
        .send_invite_now ??
      !editMode
  );

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({});

  const normalizedLocations =
    useMemo(
      () =>
        locations
          .map(
            normalizeLocation
          )
          .filter(
            (location) =>
              location.id
          ),
      [locations]
    );

  const roleOptions =
    useMemo(
      () =>
        allowedRoles.map(
          (allowedRole) => ({
            value:
              allowedRole,

            label:
              ROLE_LABELS?.[
                allowedRole
              ] ??
              allowedRole,
          })
        ),
      [allowedRoles]
    );

  const isTechnician =
    role === ROLE.TECHNICIAN;

  const locationRule =
    getLocationRule(role);

  const showLocations =
    locationRule.maximum !== 0;

  const activeLocationIds =
    useMemo(
      () =>
        normalizedLocations
          .filter(
            (location) =>
              location.isActive
          )
          .map((location) =>
            String(
              location.id
            )
          ),
      [normalizedLocations]
    );

  const allLocationsSelected =
    locationRule.multiple &&
    activeLocationIds.length >
      0 &&
    activeLocationIds.every(
      (id) =>
        locationIds.includes(
          id
        )
    );

  function clearFieldError(
    fieldName
  ) {
    setFieldErrors(
      (current) => ({
        ...current,

        [fieldName]: "",
      })
    );
  }

  function handleRoleChange(
    event
  ) {
    const nextRole =
      event.target.value;

    const nextLocationRule =
      getLocationRule(
        nextRole
      );

    setRole(nextRole);

    clearFieldError("role");
    clearFieldError(
      "locationIds"
    );

    if (
      nextRole !==
      ROLE.TECHNICIAN
    ) {
      setAvailability(
        "AVAILABLE"
      );

      clearFieldError(
        "specialization"
      );

      clearFieldError(
        "availability"
      );
    }

    if (
      nextLocationRule.maximum ===
      0
    ) {
      setLocationIds([]);
    } else if (
      nextLocationRule.maximum ===
        1 &&
      locationIds.length > 1
    ) {
      setLocationIds(
        locationIds.slice(0, 1)
      );
    }
  }

  function handleLocationToggle(
    locationId
  ) {
    const normalizedId =
      String(locationId);

    setLocationIds(
      (current) => {
        if (
          !locationRule.multiple
        ) {
          return current.includes(
            normalizedId
          )
            ? []
            : [normalizedId];
        }

        if (
          current.includes(
            normalizedId
          )
        ) {
          return current.filter(
            (id) =>
              id !==
              normalizedId
          );
        }

        return [
          ...current,
          normalizedId,
        ];
      }
    );

    clearFieldError(
      "locationIds"
    );
  }

  function handleSelectAllLocations() {
    if (
      !locationRule.multiple
    ) {
      return;
    }

    setLocationIds(
      allLocationsSelected
        ? []
        : activeLocationIds
    );

    clearFieldError(
      "locationIds"
    );
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      busy ||
      typeof onSubmit !==
        "function"
    ) {
      return;
    }

    const formElement =
      event.currentTarget;

    const formData =
      new FormData(
        formElement
      );

    const payload = {
      id:
        initialValues.id ??
        null,

      fullName: String(
        formData.get(
          "fullName"
        ) || ""
      ).trim(),

      email: String(
        formData.get(
          "email"
        ) || ""
      )
        .trim()
        .toLowerCase(),

      phone:
        normalizePhone(
          formData.get(
            "phone"
          )
        ),

      role,

      locationIds:
        showLocations
          ? locationIds
          : [],

      specialization:
        isTechnician
          ? String(
              formData.get(
                "specialization"
              ) || ""
            ).trim()
          : "",

      availabilityStatus:
        isTechnician
          ? availability
          : "AVAILABLE",

      isActive,

      sendInviteNow:
        editMode
          ? false
          : sendInviteNow,
    };

    const nextErrors = {};

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      payload.fullName.length <
      2
    ) {
      nextErrors.fullName =
        "الاسم الكامل يجب ألا يقل عن حرفين.";
    } else if (
      payload.fullName.length >
      150
    ) {
      nextErrors.fullName =
        "الاسم الكامل يجب ألا يتجاوز 150 حرفًا.";
    }

    if (
      !emailPattern.test(
        payload.email
      )
    ) {
      nextErrors.email =
        "أدخل بريدًا إلكترونيًا صحيحًا.";
    }

    if (
      !isValidPhone(
        payload.phone
      )
    ) {
      nextErrors.phone =
        "أدخل رقم جوال صحيحًا.";
    }

    if (
      !allowedRoles.includes(
        payload.role
      )
    ) {
      nextErrors.role =
        "الدور المحدد غير مسموح.";
    }

    if (
      locationRule.required &&
      payload.locationIds
        .length <
        locationRule.minimum
    ) {
      nextErrors.locationIds =
        role ===
        ROLE.BRANCH_MANAGER
          ? "يجب تحديد فرع واحد لمدير الفرع."
          : "يجب تحديد فرع واحد على الأقل.";
    }

    if (
      locationRule.maximum ===
        1 &&
      payload.locationIds
        .length > 1
    ) {
      nextErrors.locationIds =
        "يمكن ربط مدير الفرع بفرع واحد فقط.";
    }

    if (
      isTechnician &&
      payload.specialization
        .length < 2
    ) {
      nextErrors.specialization =
        "تخصص الفني مطلوب.";
    }

    if (
      isTechnician &&
      !AVAILABILITY_OPTIONS.some(
        (option) =>
          option.value ===
          payload
            .availabilityStatus
      )
    ) {
      nextErrors.availability =
        "حالة توفر الفني غير صحيحة.";
    }

    setFieldErrors(
      nextErrors
    );

    if (
      Object.keys(
        nextErrors
      ).length > 0
    ) {
      return;
    }

    await onSubmit(
      payload,
      formElement
    );
  }

  return (
    <form
      className="create-modal"
      onSubmit={handleSubmit}
      noValidate
    >
      {error ? (
        <div
          className="form-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Input
        label="الاسم الكامل"
        name="fullName"
        defaultValue={
          initialValues.fullName ??
          initialValues
            .full_name ??
          ""
        }
        placeholder="مثال: محمد أحمد"
        error={
          fieldErrors.fullName
        }
        onChange={() =>
          clearFieldError(
            "fullName"
          )
        }
        disabled={busy}
        required
        minLength={2}
        maxLength={150}
        autoFocus
      />

      <div className="form-row">
        <Input
          label="البريد الإلكتروني"
          name="email"
          type="email"
          defaultValue={
            initialValues.email ??
            ""
          }
          placeholder="name@example.com"
          error={
            fieldErrors.email
          }
          onChange={() =>
            clearFieldError(
              "email"
            )
          }
          disabled={
            busy ||
            editMode
          }
          required
          dir="ltr"
          inputMode="email"
          autoComplete="email"
        />

        <Input
          label="رقم الجوال"
          name="phone"
          type="tel"
          defaultValue={
            initialValues.phone ??
            initialValues
              .phone_number ??
            ""
          }
          placeholder="05xxxxxxxx"
          error={
            fieldErrors.phone
          }
          onChange={() =>
            clearFieldError(
              "phone"
            )
          }
          disabled={busy}
          maxLength={20}
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
        />
      </div>

      <Select
        label="الدور"
        name="role"
        options={
          roleOptions
        }
        value={role}
        onChange={
          handleRoleChange
        }
        error={
          fieldErrors.role
        }
        hint={
          ROLE_DESCRIPTIONS[
            role
          ] || ""
        }
        disabled={busy}
        required
      />

      {showLocations ? (
        <fieldset
          disabled={busy}
          style={{
            display: "grid",
            gap: "10px",
            margin: 0,
            padding: "14px",

            border:
              `1px solid ${
                fieldErrors
                  .locationIds
                  ? "#bd4c47"
                  : "#dfe6e4"
              }`,

            borderRadius:
              "10px",
          }}
        >
          <legend
            style={{
              padding:
                "0 6px",

              fontSize:
                "10px",

              fontWeight:
                700,
            }}
          >
            {
              locationRule.title
            }

            {locationRule.required
              ? " *"
              : ""}
          </legend>

          {normalizedLocations
            .length === 0 ? (
            <small
              style={{
                color:
                  "#82908e",
              }}
            >
              لا توجد فروع متاحة لهذه المنشأة.
            </small>
          ) : (
            <>
              {locationRule.multiple ? (
                <label
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap: "8px",

                    paddingBottom:
                      "9px",

                    borderBottom:
                      "1px solid #edf0ef",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      allLocationsSelected
                    }
                    onChange={
                      handleSelectAllLocations
                    }
                    disabled={
                      busy ||
                      activeLocationIds
                        .length ===
                        0
                    }
                    style={{
                      width:
                        "16px",

                      height:
                        "16px",
                    }}
                  />

                  <strong
                    style={{
                      fontSize:
                        "10px",
                    }}
                  >
                    تحديد جميع الفروع
                  </strong>
                </label>
              ) : null}

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(170px, 1fr))",

                  gap: "8px",
                }}
              >
                {normalizedLocations.map(
                  (location) => {
                    const locationId =
                      String(
                        location.id
                      );

                    const selected =
                      locationIds.includes(
                        locationId
                      );

                    return (
                      <label
                        key={
                          locationId
                        }
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            "8px",

                          padding:
                            "10px",

                          border:
                            "1px solid #e5eae8",

                          borderRadius:
                            "8px",

                          background:
                            selected
                              ? "#edf7f3"
                              : "#ffffff",

                          opacity:
                            location.isActive
                              ? 1
                              : 0.55,

                          cursor:
                            busy ||
                            !location.isActive
                              ? "default"
                              : "pointer",
                        }}
                      >
                        <input
                          type={
                            locationRule.multiple
                              ? "checkbox"
                              : "radio"
                          }
                          name={
                            locationRule.multiple
                              ? undefined
                              : "singleLocation"
                          }
                          checked={
                            selected
                          }
                          onChange={() =>
                            handleLocationToggle(
                              locationId
                            )
                          }
                          disabled={
                            busy ||
                            !location.isActive
                          }
                          style={{
                            width:
                              "15px",

                            height:
                              "15px",
                          }}
                        />

                        <span
                          style={{
                            fontSize:
                              "9px",
                          }}
                        >
                          {
                            location.name
                          }
                        </span>
                      </label>
                    );
                  }
                )}
              </div>
            </>
          )}

          {fieldErrors.locationIds ? (
            <small
              className="form-error"
              role="alert"
            >
              {
                fieldErrors.locationIds
              }
            </small>
          ) : (
            <small
              style={{
                color:
                  "#82908e",
              }}
            >
              {
                locationRule.hint
              }
            </small>
          )}
        </fieldset>
      ) : (
        <div
          style={{
            padding:
              "12px",

            border:
              "1px solid #e5eae8",

            borderRadius:
              "9px",

            background:
              "#f6f9f8",

            color:
              "#71817f",

            fontSize:
              "9px",

            lineHeight:
              1.8,
          }}
        >
          {locationRule.hint}
        </div>
      )}

      {isTechnician ? (
        <div className="form-row">
          <Input
            label="التخصص"
            name="specialization"
            defaultValue={
              initialValues
                .specialization ??
              ""
            }
            placeholder="مثال: تكييف وتبريد"
            error={
              fieldErrors
                .specialization
            }
            onChange={() =>
              clearFieldError(
                "specialization"
              )
            }
            disabled={busy}
            required
            maxLength={120}
          />

          <Select
            label="حالة التوفر"
            name="availabilityStatus"
            options={
              AVAILABILITY_OPTIONS
            }
            value={
              availability
            }
            onChange={(event) => {
              setAvailability(
                event.target.value
              );

              clearFieldError(
                "availability"
              );
            }}
            error={
              fieldErrors
                .availability
            }
            disabled={busy}
            required
          />
        </div>
      ) : null}

      <label
        style={{
          display: "flex",
          alignItems:
            "center",
          gap: "10px",
          margin: 0,
        }}
      >
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) =>
            setIsActive(
              event.target.checked
            )
          }
          disabled={busy}
          style={{
            width: "16px",
            height: "16px",
          }}
        />

        <span>
          الحساب نشط ويمكنه استخدام النظام
        </span>
      </label>

      {!editMode ? (
        <label
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap: "10px",

            margin: 0,
          }}
        >
          <input
            type="checkbox"
            checked={
              sendInviteNow
            }
            onChange={(event) =>
              setSendInviteNow(
                event.target
                  .checked
              )
            }
            disabled={busy}
            style={{
              width:
                "16px",

              height:
                "16px",
            }}
          />

          <span>
            إرسال دعوة تسجيل الدخول إلى البريد الآن
          </span>
        </label>
      ) : null}

      <div className="modal-buttons">
        {typeof onCancel ===
        "function" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            إلغاء
          </Button>
        ) : null}

        <Button
          type="submit"
          loading={busy}
          loadingText="جاري الحفظ…"
        >
          {!editMode &&
          sendInviteNow
            ? "إنشاء وإرسال دعوة"
            : submitText}
        </Button>
      </div>
    </form>
  );
}
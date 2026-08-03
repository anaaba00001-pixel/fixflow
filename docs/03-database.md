# FixFlow — تصميم قاعدة البيانات

## 1. هدف هذا الملف

يوضح هذا الملف تصميم قاعدة بيانات نظام FixFlow، والجداول المطلوبة، والحقول، والعلاقات، والقيود، والفهارس، وسياسات الأمان.

قاعدة البيانات المقترحة:

- PostgreSQL.
- مستضافة من خلال Supabase.
- تستخدم UUID للمعرّفات.
- تستخدم Row Level Security لعزل بيانات الشركات.
- تحفظ التواريخ بصيغة UTC.
- تدعم عدة شركات داخل النظام نفسه.

---

# 2. المبادئ الأساسية لتصميم قاعدة البيانات

يجب الالتزام بالقواعد التالية:

1. كل شركة لها بيانات مستقلة.
2. معظم الجداول التشغيلية تحتوي على organization_id.
3. لا يستطيع مستخدم شركة رؤية بيانات شركة أخرى.
4. لا يتم حذف الطلبات نهائيًا.
5. يتم تعطيل السجلات بدل حذفها عند الحاجة.
6. كل تغيير مهم يسجل.
7. كل طلب يملك تاريخ حالات كاملًا.
8. الصور تخزن خارج الجداول داخل Supabase Storage.
9. الجداول تحفظ روابط الملفات فقط.
10. العمليات الحساسة تسجل في audit_logs.
11. جميع التواريخ تحفظ بصيغة UTC.
12. يتم عرض الوقت حسب المنطقة الزمنية للشركة.
13. القيم الثابتة تستخدم enums أو قيود CHECK.
14. العلاقات المهمة تستخدم Foreign Keys.
15. الحقول المطلوبة تستخدم NOT NULL.
16. الحقول الفريدة تستخدم UNIQUE.
17. الجداول الكبيرة تستخدم Indexes.
18. لا يوضع مفتاح سري داخل قاعدة البيانات بشكل مكشوف.
19. لا يتم تخزين كلمات المرور داخل جداول النظام.
20. كلمات المرور تديرها Supabase Auth.

---

# 3. مخطط العلاقات العام

العلاقات الرئيسية:

- الشركة لديها عدة مستخدمين.
- الشركة لديها عدة مواقع.
- الشركة لديها عدة تصنيفات.
- الموقع يحتوي على عدة أجهزة.
- الجهاز قد يحتوي على عدة طلبات صيانة.
- الطلب يتبع شركة واحدة.
- الطلب يتبع موقعًا واحدًا.
- الطلب قد يتبع جهازًا واحدًا.
- الطلب قد يعيّن إلى فني واحد في الوقت الحالي.
- الطلب يحتوي على عدة ملاحظات.
- الطلب يحتوي على عدة مرفقات.
- الطلب يحتوي على عدة أحداث تاريخية.
- الطلب يحتوي على عدة قطع غيار مستخدمة.
- الطلب قد يحتوي على تقييم.
- المستخدم قد يرتبط بعدة مواقع.
- الشركة لديها إعدادات واحدة رئيسية.
- الشركة لديها اشتراك واحد نشط أو سجل اشتراكات.

---

# 4. أنواع البيانات الثابتة

## 4.1 أدوار المستخدمين

القيم المقترحة:

- SUPER_ADMIN
- COMPANY_ADMIN
- SUPERVISOR
- TECHNICIAN

## 4.2 حالة الشركة

- ACTIVE
- GRACE_PERIOD
- SUSPENDED
- CANCELLED

## 4.3 حالة المستخدم

يمكن استخدام حقل is_active من نوع Boolean.

القيم:

- true
- false

## 4.4 حالة الجهاز

- ACTIVE
- INACTIVE
- UNDER_MAINTENANCE
- RETIRED

## 4.5 حالة طلب الصيانة

- NEW
- ASSIGNED
- ACCEPTED
- IN_PROGRESS
- WAITING_PARTS
- PENDING_APPROVAL
- CLOSED
- REOPENED
- CANCELLED

## 4.6 أولوية الطلب

- LOW
- MEDIUM
- HIGH
- EMERGENCY

## 4.7 نوع المرفق

- REPORTER_IMAGE
- BEFORE_REPAIR
- AFTER_REPAIR
- DOCUMENT
- OTHER

## 4.8 نوع الإشعار

- TICKET_CREATED
- EMERGENCY_TICKET
- TECHNICIAN_ASSIGNED
- TICKET_ACCEPTED
- TICKET_REJECTED
- WORK_STARTED
- WAITING_PARTS
- WORK_RESUMED
- TICKET_OVERDUE
- REPAIR_COMPLETED
- APPROVAL_REQUIRED
- REPAIR_REJECTED
- TICKET_CLOSED
- TICKET_REOPENED
- TICKET_CANCELLED
- SUBSCRIPTION_EXPIRING
- SUBSCRIPTION_EXPIRED

## 4.9 قناة الإشعار

- IN_APP
- EMAIL

## 4.10 حالة إرسال الإشعار

- PENDING
- SENT
- FAILED
- CANCELLED

## 4.11 نوع الملاحظة

يمكن استخدام الحقل is_internal:

- true: داخلية.
- false: عامة.

## 4.12 حالة الاشتراك

- TRIAL
- ACTIVE
- PAST_DUE
- GRACE_PERIOD
- SUSPENDED
- CANCELLED
- EXPIRED

---

# 5. جدول organizations

## الغرض

يحفظ بيانات الشركات المشتركة في FixFlow.

## اسم الجدول

organizations

## الحقول

### id

- النوع: UUID.
- المفتاح الأساسي.
- يولد تلقائيًا.
- لا يقبل null.

### name

- النوع: TEXT.
- اسم الشركة.
- لا يقبل null.
- مثال: شركة النور لإدارة العقارات.

### slug

- النوع: TEXT.
- اسم مختصر فريد يستخدم داخليًا.
- لا يقبل null.
- يجب أن يكون Unique.
- مثال: alnoor-properties.

### logo_url

- النوع: TEXT.
- رابط شعار الشركة.
- اختياري.

### email

- النوع: TEXT.
- البريد الرسمي للشركة.
- اختياري.
- يجب التحقق من صيغته في التطبيق.

### phone

- النوع: TEXT.
- رقم التواصل.
- اختياري.

### city

- النوع: TEXT.
- مدينة الشركة.
- اختياري.

### timezone

- النوع: TEXT.
- المنطقة الزمنية.
- لا يقبل null.
- القيمة الافتراضية:
  Asia/Riyadh

### status

- النوع: organization_status.
- لا يقبل null.
- القيمة الافتراضية:
  ACTIVE

### plan_code

- النوع: TEXT.
- رمز الباقة الحالية.
- اختياري في البداية.
- مثال:
  STARTER
  BUSINESS
  ENTERPRISE

### subscription_start

- النوع: TIMESTAMPTZ.
- تاريخ بداية الاشتراك.
- اختياري.

### subscription_end

- النوع: TIMESTAMPTZ.
- تاريخ انتهاء الاشتراك.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.
- القيمة الافتراضية:
  now()

### updated_at

- النوع: TIMESTAMPTZ.
- يحدث تلقائيًا عند التعديل.

## القيود

- slug يجب أن يكون فريدًا.
- name لا يكون فارغًا.
- subscription_end لا يكون قبل subscription_start.
- status يجب أن يكون من القيم المعتمدة.

## الفهارس

- Index على slug.
- Index على status.
- Index على subscription_end.

---

# 6. جدول profiles

## الغرض

يحفظ معلومات مستخدمي النظام المرتبطة بحسابات Supabase Auth.

## اسم الجدول

profiles

## العلاقة مع Supabase Auth

يكون:

profiles.id = auth.users.id

## الحقول

### id

- النوع: UUID.
- المفتاح الأساسي.
- مفتاح خارجي إلى auth.users.id.
- لا يقبل null.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- يقبل null فقط لمدير المنصة SUPER_ADMIN.
- إلزامي لبقية المستخدمين.

### full_name

- النوع: TEXT.
- الاسم الكامل.
- لا يقبل null.

### email

- النوع: TEXT.
- البريد الإلكتروني.
- لا يقبل null.
- يفضل مزامنته مع auth.users.email.

### phone

- النوع: TEXT.
- اختياري.

### avatar_url

- النوع: TEXT.
- رابط الصورة الشخصية.
- اختياري.

### role

- النوع: user_role.
- لا يقبل null.

### specialty

- النوع: TEXT.
- تخصص الفني.
- اختياري.
- يستخدم غالبًا مع TECHNICIAN.

### is_available

- النوع: BOOLEAN.
- يحدد توفر الفني.
- القيمة الافتراضية:
  true

### is_active

- النوع: BOOLEAN.
- يحدد هل الحساب فعال.
- القيمة الافتراضية:
  true

### last_login_at

- النوع: TIMESTAMPTZ.
- آخر تسجيل دخول.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.
- القيمة الافتراضية:
  now()

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- SUPER_ADMIN يمكن أن يكون organization_id لديه null.
- بقية الأدوار يجب أن تملك organization_id.
- specialty مطلوب عند كون الدور TECHNICIAN وفق قواعد التطبيق.
- البريد يفضل أن يكون فريدًا على مستوى نظام المصادقة.

## الفهارس

- Index على organization_id.
- Index على role.
- Index على is_active.
- Index على is_available.
- Index مركب على organization_id وrole.

---

# 7. جدول user_locations

## الغرض

يربط المستخدم بالمواقع التي يسمح له بالوصول إليها.

يستخدم عندما يكون المستخدم مشرفًا أو فنيًا ويعمل في مواقع محددة فقط.

## اسم الجدول

user_locations

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.
- يولد تلقائيًا.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- لا يقبل null.

### user_id

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- لا يقبل null.

### location_id

- النوع: UUID.
- مفتاح خارجي إلى locations.id.
- لا يقبل null.

### created_at

- النوع: TIMESTAMPTZ.
- القيمة الافتراضية:
  now()

## القيود

- يمنع تكرار الربط نفسه.
- Unique مركب على:
  user_id + location_id
- يجب أن يكون المستخدم والموقع تابعين للشركة نفسها.

## الفهارس

- Index على user_id.
- Index على location_id.
- Index على organization_id.

---

# 8. جدول locations

## الغرض

يحفظ الفروع والمباني والمواقع التابعة للشركة.

## اسم الجدول

locations

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.
- يولد تلقائيًا.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- لا يقبل null.

### name

- النوع: TEXT.
- اسم الموقع.
- لا يقبل null.

### code

- النوع: TEXT.
- رمز داخلي للموقع.
- اختياري.
- مثال:
  RUH-01

### type

- النوع: TEXT.
- نوع الموقع.
- اختياري.
- أمثلة:
  فرع
  مدرسة
  مجمع
  مستودع
  مكتب

### city

- النوع: TEXT.
- اختياري.

### address

- النوع: TEXT.
- اختياري.

### description

- النوع: TEXT.
- اختياري.

### manager_name

- النوع: TEXT.
- اسم مسؤول الموقع.
- اختياري.

### manager_phone

- النوع: TEXT.
- رقم مسؤول الموقع.
- اختياري.

### latitude

- النوع: NUMERIC.
- اختياري.
- للموقع الجغرافي مستقبلًا.

### longitude

- النوع: NUMERIC.
- اختياري.

### is_active

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### created_at

- النوع: TIMESTAMPTZ.
- القيمة الافتراضية:
  now()

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- name لا يكون فارغًا.
- يفضل منع تكرار code داخل الشركة.
- Unique مركب:
  organization_id + code
- الموقع لا يحذف عند وجود طلبات مرتبطة به.
- يتم تعطيله باستخدام is_active.

## الفهارس

- Index على organization_id.
- Index على is_active.
- Index مركب على organization_id وname.

---

# 9. جدول categories

## الغرض

يحفظ أنواع الصيانة والأعطال.

## اسم الجدول

categories

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- لا يقبل null.

### name

- النوع: TEXT.
- لا يقبل null.
- مثال:
  تكييف

### description

- النوع: TEXT.
- اختياري.

### icon

- النوع: TEXT.
- اسم الأيقونة.
- اختياري.

### color

- النوع: TEXT.
- لون التصنيف.
- اختياري.
- مثال:
  #2563EB

### default_response_minutes

- النوع: INTEGER.
- وقت الاستجابة الافتراضي بالدقائق.
- اختياري.

### is_active

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### created_at

- النوع: TIMESTAMPTZ.

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- يمنع تكرار اسم التصنيف داخل الشركة.
- Unique مركب:
  organization_id + name
- default_response_minutes يجب أن يكون أكبر من أو يساوي صفرًا.

## الفهارس

- Index على organization_id.
- Index على is_active.

---

# 10. جدول assets

## الغرض

يحفظ الأجهزة والأصول والغرف التي يمكن الإبلاغ عنها.

## اسم الجدول

assets

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- لا يقبل null.

### location_id

- النوع: UUID.
- مفتاح خارجي إلى locations.id.
- لا يقبل null.

### category_id

- النوع: UUID.
- مفتاح خارجي إلى categories.id.
- اختياري.

### name

- النوع: TEXT.
- اسم الجهاز.
- لا يقبل null.

### asset_code

- النوع: TEXT.
- الرقم الداخلي للجهاز.
- لا يقبل null.

### serial_number

- النوع: TEXT.
- الرقم التسلسلي.
- اختياري.

### manufacturer

- النوع: TEXT.
- الشركة المصنعة.
- اختياري.

### model

- النوع: TEXT.
- الموديل.
- اختياري.

### purchase_date

- النوع: DATE.
- اختياري.

### warranty_end_date

- النوع: DATE.
- اختياري.

### last_maintenance_date

- النوع: DATE.
- اختياري.

### image_url

- النوع: TEXT.
- اختياري.

### qr_token

- النوع: TEXT.
- رمز عشوائي طويل.
- لا يقبل null.
- يجب أن يكون Unique.

### qr_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### status

- النوع: asset_status.
- القيمة الافتراضية:
  ACTIVE

### notes

- النوع: TEXT.
- اختياري.

### created_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- asset_code فريد داخل الشركة.
- qr_token فريد على مستوى النظام.
- warranty_end_date لا يكون قبل purchase_date.
- location_id يجب أن يكون تابعًا للشركة نفسها.
- category_id يجب أن يكون تابعًا للشركة نفسها.

## الفهارس

- Index على organization_id.
- Index على location_id.
- Index على category_id.
- Index على status.
- Unique Index على qr_token.
- Unique Index مركب على organization_id وasset_code.
- Index على serial_number.

---

# 11. جدول tickets

## الغرض

يمثل طلبات الصيانة وهو أهم جدول في النظام.

## اسم الجدول

tickets

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.
- يولد تلقائيًا.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- لا يقبل null.

### location_id

- النوع: UUID.
- مفتاح خارجي إلى locations.id.
- لا يقبل null.

### asset_id

- النوع: UUID.
- مفتاح خارجي إلى assets.id.
- اختياري.
- يسمح بطلب لموقع دون جهاز.

### category_id

- النوع: UUID.
- مفتاح خارجي إلى categories.id.
- لا يقبل null.

### ticket_number

- النوع: TEXT.
- رقم مرجعي واضح.
- لا يقبل null.
- مثال:
  MT-2026-000125

### title

- النوع: TEXT.
- عنوان مختصر للمشكلة.
- لا يقبل null.

### description

- النوع: TEXT.
- وصف المشكلة.
- لا يقبل null.

### priority

- النوع: ticket_priority.
- لا يقبل null.
- القيمة الافتراضية:
  MEDIUM

### status

- النوع: ticket_status.
- لا يقبل null.
- القيمة الافتراضية:
  NEW

### reporter_name

- النوع: TEXT.
- اختياري حسب سياسة الشركة.

### reporter_email

- النوع: TEXT.
- اختياري.

### reporter_phone

- النوع: TEXT.
- اختياري.

### public_tracking_token

- النوع: TEXT.
- رمز عشوائي لمتابعة الطلب.
- لا يقبل null.
- يجب أن يكون Unique.

### assigned_technician_id

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري.

### created_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري.
- يكون null عند إنشاء الطلب من صفحة عامة.

### reviewed_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري.

### approved_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري.

### cancellation_reason

- النوع: TEXT.
- اختياري.
- يصبح مطلوبًا عند CANCELLED.

### reopen_reason

- النوع: TEXT.
- اختياري.
- يصبح مطلوبًا عند REOPENED.

### rejection_reason

- النوع: TEXT.
- اختياري.
- يستخدم عند إعادة الإصلاح للفني.

### resolution_summary

- النوع: TEXT.
- ملخص الإصلاح.
- اختياري حتى مرحلة الإكمال.

### fault_cause

- النوع: TEXT.
- سبب العطل.
- اختياري.

### due_at

- النوع: TIMESTAMPTZ.
- الموعد المتوقع لإنجاز الطلب.

### is_overdue

- النوع: BOOLEAN.
- القيمة الافتراضية:
  false

### reopen_count

- النوع: INTEGER.
- القيمة الافتراضية:
  0

### assigned_at

- النوع: TIMESTAMPTZ.
- اختياري.

### accepted_at

- النوع: TIMESTAMPTZ.
- اختياري.

### started_at

- النوع: TIMESTAMPTZ.
- اختياري.

### waiting_parts_at

- النوع: TIMESTAMPTZ.
- اختياري.

### resumed_at

- النوع: TIMESTAMPTZ.
- اختياري.

### completed_at

- النوع: TIMESTAMPTZ.
- اختياري.

### approved_at

- النوع: TIMESTAMPTZ.
- اختياري.

### closed_at

- النوع: TIMESTAMPTZ.
- اختياري.

### cancelled_at

- النوع: TIMESTAMPTZ.
- اختياري.

### reopened_at

- النوع: TIMESTAMPTZ.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.
- القيمة الافتراضية:
  now()

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- ticket_number فريد داخل الشركة.
- public_tracking_token فريد.
- description لا يكون فارغًا.
- assigned_technician_id يجب أن يكون فنيًا تابعًا للشركة.
- location_id يجب أن يكون تابعًا للشركة.
- asset_id يجب أن يكون تابعًا للموقع والشركة.
- category_id يجب أن يكون تابعًا للشركة.
- cancellation_reason مطلوب عند الحالة CANCELLED.
- reopen_reason مطلوب عند الحالة REOPENED.
- reopen_count لا يكون سالبًا.
- لا يسمح بحذف الطلب نهائيًا.

## الفهارس

- Index على organization_id.
- Index على ticket_number.
- Index على status.
- Index على priority.
- Index على location_id.
- Index على asset_id.
- Index على category_id.
- Index على assigned_technician_id.
- Index على created_at.
- Index على due_at.
- Index على is_overdue.
- Unique Index على public_tracking_token.
- Index مركب على organization_id وstatus.
- Index مركب على organization_id وcreated_at.
- Index مركب على assigned_technician_id وstatus.

---

# 12. جدول ticket_comments

## الغرض

يحفظ الملاحظات والتعليقات المرتبطة بالطلب.

## اسم الجدول

ticket_comments

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### ticket_id

- النوع: UUID.
- مفتاح خارجي إلى tickets.id.
- لا يقبل null.

### user_id

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري عند تعليق المبلّغ العام.

### author_name

- النوع: TEXT.
- اختياري.
- يستخدم عند عدم وجود user_id.

### comment

- النوع: TEXT.
- لا يقبل null.

### is_internal

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### created_at

- النوع: TIMESTAMPTZ.

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- comment لا يكون فارغًا.
- ticket_id يتبع organization_id نفسه.
- المبلّغ لا يرى التعليقات التي is_internal = true.

## الفهارس

- Index على ticket_id.
- Index على organization_id.
- Index على created_at.

---

# 13. جدول ticket_attachments

## الغرض

يحفظ بيانات الصور والمرفقات.

## اسم الجدول

ticket_attachments

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### ticket_id

- النوع: UUID.
- لا يقبل null.

### uploaded_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري عند رفع المبلّغ.

### uploader_name

- النوع: TEXT.
- اختياري.

### file_path

- النوع: TEXT.
- مسار الملف داخل Storage.
- لا يقبل null.

### file_name

- النوع: TEXT.
- الاسم الأصلي أو الاسم المعروض.
- لا يقبل null.

### mime_type

- النوع: TEXT.
- لا يقبل null.

### file_size

- النوع: BIGINT.
- حجم الملف بالبايت.
- لا يقبل null.

### attachment_type

- النوع: attachment_type.
- لا يقبل null.

### is_public_to_reporter

- النوع: BOOLEAN.
- القيمة الافتراضية:
  false

### created_at

- النوع: TIMESTAMPTZ.

## القيود

- الملف يتبع الشركة نفسها.
- حجم الملف أكبر من صفر.
- mime_type من الأنواع المسموحة.
- file_path فريد حسب سياسة التخزين.

## الفهارس

- Index على ticket_id.
- Index على organization_id.
- Index على attachment_type.
- Index على created_at.

---

# 14. جدول ticket_history

## الغرض

يسجل كل تغيير مهم في طلب الصيانة.

## اسم الجدول

ticket_history

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### ticket_id

- النوع: UUID.
- لا يقبل null.

### changed_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري عند التنفيذ التلقائي.

### actor_type

- النوع: TEXT.
- القيم المقترحة:
  USER
  SYSTEM
  REPORTER

### action

- النوع: TEXT.
- لا يقبل null.
- أمثلة:
  CREATED
  ASSIGNED
  ACCEPTED
  STARTED
  STATUS_CHANGED
  COMMENT_ADDED
  ATTACHMENT_ADDED
  COMPLETED
  APPROVED
  CLOSED
  REOPENED
  CANCELLED

### old_status

- النوع: ticket_status.
- اختياري.

### new_status

- النوع: ticket_status.
- اختياري.

### note

- النوع: TEXT.
- اختياري.

### metadata

- النوع: JSONB.
- اختياري.
- يحفظ معلومات إضافية مثل الفني القديم والجديد.

### created_at

- النوع: TIMESTAMPTZ.

## القيود

- لا تعدل السجلات التاريخية بعد إنشائها إلا بصلاحية خاصة جدًا.
- ticket_id يتبع organization_id نفسه.

## الفهارس

- Index على ticket_id.
- Index على organization_id.
- Index على created_at.
- Index على action.

---

# 15. جدول spare_parts_used

## الغرض

يحفظ قطع الغيار المستخدمة في طلب معين.

## اسم الجدول

spare_parts_used

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### ticket_id

- النوع: UUID.
- لا يقبل null.

### added_by

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- لا يقبل null.

### part_name

- النوع: TEXT.
- لا يقبل null.

### part_number

- النوع: TEXT.
- اختياري.

### quantity

- النوع: NUMERIC.
- لا يقبل null.
- القيمة الافتراضية:
  1

### unit_cost

- النوع: NUMERIC.
- اختياري.

### total_cost

- النوع: NUMERIC.
- يمكن حسابه تلقائيًا.
- اختياري.

### notes

- النوع: TEXT.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.

## القيود

- quantity أكبر من صفر.
- unit_cost لا يكون سالبًا.
- total_cost لا يكون سالبًا.
- total_cost يساوي quantity × unit_cost عند توفر التكلفة.

## الفهارس

- Index على ticket_id.
- Index على organization_id.

---

# 16. جدول ticket_ratings

## الغرض

يحفظ تقييم المبلّغ لخدمة الصيانة.

## اسم الجدول

ticket_ratings

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### ticket_id

- النوع: UUID.
- لا يقبل null.

### rating

- النوع: SMALLINT.
- لا يقبل null.

### comment

- النوع: TEXT.
- اختياري.

### reporter_name

- النوع: TEXT.
- اختياري.

### tracking_token_used

- النوع: TEXT.
- اختياري لأغراض التحقق.

### created_at

- النوع: TIMESTAMPTZ.

## القيود

- rating بين 1 و5.
- يفضل تقييم واحد لكل طلب.
- Unique على ticket_id إذا كانت السياسة تسمح بتقييم واحد فقط.
- الطلب يجب أن يكون مغلقًا أو مكتملًا.

## الفهارس

- Index على ticket_id.
- Index على organization_id.
- Index على rating.

---

# 17. جدول notifications

## الغرض

يحفظ جميع الإشعارات الداخلية والبريدية.

## اسم الجدول

notifications

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### user_id

- النوع: UUID.
- مفتاح خارجي إلى profiles.id.
- اختياري عند إرسال إشعار لمبلّغ خارجي.

### ticket_id

- النوع: UUID.
- مفتاح خارجي إلى tickets.id.
- اختياري.

### recipient_email

- النوع: TEXT.
- اختياري.

### type

- النوع: notification_type.
- لا يقبل null.

### title

- النوع: TEXT.
- لا يقبل null.

### message

- النوع: TEXT.
- لا يقبل null.

### channel

- النوع: notification_channel.
- لا يقبل null.

### status

- النوع: notification_status.
- القيمة الافتراضية:
  PENDING

### retry_count

- النوع: INTEGER.
- القيمة الافتراضية:
  0

### read_at

- النوع: TIMESTAMPTZ.
- اختياري.

### sent_at

- النوع: TIMESTAMPTZ.
- اختياري.

### failed_at

- النوع: TIMESTAMPTZ.
- اختياري.

### error_message

- النوع: TEXT.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.

## القيود

- يجب وجود user_id أو recipient_email.
- retry_count لا يكون سالبًا.
- لا تعرض error_message للمستخدم العادي.
- الإشعار الداخلي يفضل أن يحتوي user_id.

## الفهارس

- Index على user_id.
- Index على ticket_id.
- Index على organization_id.
- Index على status.
- Index على read_at.
- Index مركب على user_id وread_at.

---

# 18. جدول audit_logs

## الغرض

يحفظ العمليات الحساسة لأغراض الأمان والتتبع.

## اسم الجدول

audit_logs

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- اختياري لبعض عمليات مدير المنصة.

### user_id

- النوع: UUID.
- اختياري عند تنفيذ النظام للعملية.

### action

- النوع: TEXT.
- لا يقبل null.

### entity_type

- النوع: TEXT.
- لا يقبل null.
- أمثلة:
  ORGANIZATION
  USER
  LOCATION
  ASSET
  TICKET
  SETTINGS
  SUBSCRIPTION

### entity_id

- النوع: UUID.
- اختياري.

### old_values

- النوع: JSONB.
- اختياري.

### new_values

- النوع: JSONB.
- اختياري.

### ip_address

- النوع: INET.
- اختياري.

### user_agent

- النوع: TEXT.
- اختياري.

### request_id

- النوع: TEXT.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.

## قواعد مهمة

- لا يسمح للمستخدمين العاديين بتعديل السجلات.
- لا يسمح بحذف السجلات من الواجهة.
- بيانات الأسرار وكلمات المرور لا تحفظ داخل old_values أو new_values.
- يمكن تحديد مدة احتفاظ وفق سياسة النظام.

## الفهارس

- Index على organization_id.
- Index على user_id.
- Index على entity_type.
- Index على entity_id.
- Index على created_at.
- Index على action.

---

# 19. جدول organization_settings

## الغرض

يحفظ إعدادات التشغيل الخاصة بكل شركة.

## اسم الجدول

organization_settings

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- مفتاح خارجي إلى organizations.id.
- لا يقبل null.
- يجب أن يكون Unique.

### low_priority_minutes

- النوع: INTEGER.
- القيمة الافتراضية المقترحة:
  2880

### medium_priority_minutes

- النوع: INTEGER.
- القيمة الافتراضية المقترحة:
  1440

### high_priority_minutes

- النوع: INTEGER.
- القيمة الافتراضية المقترحة:
  480

### emergency_priority_minutes

- النوع: INTEGER.
- القيمة الافتراضية المقترحة:
  60

### technician_acceptance_minutes

- النوع: INTEGER.
- مدة قبول الفني.
- القيمة الافتراضية:
  30

### reporter_confirmation_hours

- النوع: INTEGER.
- مدة انتظار تأكيد المبلّغ.
- القيمة الافتراضية:
  24

### auto_close_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  false

### daily_report_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  false

### monthly_report_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  false

### daily_report_time

- النوع: TIME.
- اختياري.

### daily_report_email

- النوع: TEXT.
- اختياري.

### monthly_report_email

- النوع: TEXT.
- اختياري.

### working_days

- النوع: JSONB.
- يحفظ أيام العمل.

### working_hours

- النوع: JSONB.
- يحفظ وقت البداية والنهاية.

### require_before_photo

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### require_after_photo

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### require_reporter_confirmation

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### created_at

- النوع: TIMESTAMPTZ.

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- سجل واحد لكل شركة.
- القيم الزمنية لا تكون سالبة.
- البريد يجب أن يكون صالحًا عند تعبئته.

---

# 20. جدول subscriptions

## الغرض

يحفظ تاريخ اشتراكات الشركة بدل الاكتفاء بالاشتراك الحالي فقط.

## اسم الجدول

subscriptions

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### plan_code

- النوع: TEXT.
- لا يقبل null.

### status

- النوع: subscription_status.
- لا يقبل null.

### start_at

- النوع: TIMESTAMPTZ.
- لا يقبل null.

### end_at

- النوع: TIMESTAMPTZ.
- لا يقبل null.

### grace_period_end_at

- النوع: TIMESTAMPTZ.
- اختياري.

### amount

- النوع: NUMERIC.
- اختياري.

### currency

- النوع: TEXT.
- القيمة الافتراضية:
  SAR

### payment_reference

- النوع: TEXT.
- اختياري.

### notes

- النوع: TEXT.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.

### updated_at

- النوع: TIMESTAMPTZ.

## القيود

- end_at بعد start_at.
- amount لا يكون سالبًا.
- لا يكون هناك أكثر من اشتراك ACTIVE لنفس الشركة وفق سياسة النظام.

## الفهارس

- Index على organization_id.
- Index على status.
- Index على end_at.

---

# 21. جدول notification_preferences

## الغرض

يحفظ تفضيلات الإشعارات لكل مستخدم.

## اسم الجدول

notification_preferences

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- لا يقبل null.

### user_id

- النوع: UUID.
- لا يقبل null.
- يجب أن يكون Unique.

### in_app_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### email_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### new_ticket_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### assignment_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### overdue_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### completion_enabled

- النوع: BOOLEAN.
- القيمة الافتراضية:
  true

### created_at

- النوع: TIMESTAMPTZ.

### updated_at

- النوع: TIMESTAMPTZ.

---

# 22. جدول system_errors

## الغرض

يحفظ الأخطاء التقنية المهمة داخل النظام.

يمكن الاستغناء عنه لاحقًا عند استخدام خدمة مراقبة خارجية، لكنه مفيد في النسخة الأولى.

## اسم الجدول

system_errors

## الحقول

### id

- النوع: UUID.
- مفتاح أساسي.

### organization_id

- النوع: UUID.
- اختياري.

### user_id

- النوع: UUID.
- اختياري.

### error_code

- النوع: TEXT.
- اختياري.

### message

- النوع: TEXT.
- لا يقبل null.

### stack_trace

- النوع: TEXT.
- اختياري.
- لا يعرض للمستخدم.

### page

- النوع: TEXT.
- اختياري.

### operation

- النوع: TEXT.
- اختياري.

### metadata

- النوع: JSONB.
- اختياري.

### resolved

- النوع: BOOLEAN.
- القيمة الافتراضية:
  false

### resolved_at

- النوع: TIMESTAMPTZ.
- اختياري.

### created_at

- النوع: TIMESTAMPTZ.

## ملاحظة

يجب عدم حفظ:

- كلمات المرور.
- مفاتيح API.
- رموز الجلسات.
- بيانات حساسة كاملة.

---

# 23. علاقات المفاتيح الخارجية

العلاقات الأساسية:

- profiles.organization_id → organizations.id
- user_locations.user_id → profiles.id
- user_locations.location_id → locations.id
- locations.organization_id → organizations.id
- categories.organization_id → organizations.id
- assets.organization_id → organizations.id
- assets.location_id → locations.id
- assets.category_id → categories.id
- tickets.organization_id → organizations.id
- tickets.location_id → locations.id
- tickets.asset_id → assets.id
- tickets.category_id → categories.id
- tickets.assigned_technician_id → profiles.id
- tickets.created_by → profiles.id
- tickets.reviewed_by → profiles.id
- tickets.approved_by → profiles.id
- ticket_comments.ticket_id → tickets.id
- ticket_comments.user_id → profiles.id
- ticket_attachments.ticket_id → tickets.id
- ticket_attachments.uploaded_by → profiles.id
- ticket_history.ticket_id → tickets.id
- ticket_history.changed_by → profiles.id
- spare_parts_used.ticket_id → tickets.id
- spare_parts_used.added_by → profiles.id
- ticket_ratings.ticket_id → tickets.id
- notifications.user_id → profiles.id
- notifications.ticket_id → tickets.id
- audit_logs.user_id → profiles.id
- organization_settings.organization_id → organizations.id
- subscriptions.organization_id → organizations.id
- notification_preferences.user_id → profiles.id

---

# 24. سياسات الحذف

## organizations

لا تحذف مباشرة بعد وجود بيانات.

يتم تغيير status إلى:

- SUSPENDED
- CANCELLED

## profiles

لا تحذف عند وجود تاريخ نشاط.

يتم:

- is_active = false

## locations

لا تحذف عند وجود أجهزة أو طلبات.

يتم:

- is_active = false

## categories

لا تحذف عند ارتباطها بطلبات.

يتم:

- is_active = false

## assets

لا تحذف عند وجود تاريخ صيانة.

يتم تغيير status إلى:

- INACTIVE
- RETIRED

## tickets

لا تحذف نهائيًا.

تستخدم الحالات:

- CLOSED
- CANCELLED

## comments والمرفقات

لا تحذف دون صلاحية.

عند الحاجة يمكن استخدام:

- deleted_at
- deleted_by

لكن يمكن تأجيل الحذف المنطقي للنسخة اللاحقة.

---

# 25. تحديث updated_at تلقائيًا

يجب إنشاء Trigger عام يحدث updated_at تلقائيًا عند تعديل السجلات.

يطبق على:

- organizations
- profiles
- locations
- categories
- assets
- tickets
- ticket_comments
- organization_settings
- subscriptions
- notification_preferences

---

# 26. إنشاء رقم الطلب تلقائيًا

يجب إنشاء وظيفة في قاعدة البيانات لتوليد رقم الطلب.

الصيغة المقترحة:

MT-{YEAR}-{SEQUENCE}

مثال:

MT-2026-000125

القواعد:

- الرقم فريد داخل الشركة.
- التسلسل يزداد.
- السنة تستخدم السنة الحالية.
- لا يعتمد على عدد السجلات فقط لتجنب التكرار.
- يفضل استخدام Sequence أو جدول counters خاص بالشركة.

## جدول اختياري ticket_counters

الحقول:

- organization_id
- year
- last_number
- updated_at

Unique على:

- organization_id + year

---

# 27. حساب due_at

عند إنشاء الطلب:

1. يقرأ النظام أولوية الطلب.
2. يقرأ إعدادات الشركة.
3. يحدد عدد الدقائق.
4. يضيفها إلى created_at.
5. يحفظ النتيجة في due_at.

مثال:

- EMERGENCY = 60 دقيقة.
- HIGH = 480 دقيقة.
- MEDIUM = 1440 دقيقة.
- LOW = 2880 دقيقة.

يمكن لاحقًا احتساب ساعات العمل فقط.

---

# 28. حساب أزمنة الأداء

يمكن حساب القيم التالية:

## assignment_time_minutes

الفرق بين:

created_at وassigned_at

## acceptance_time_minutes

الفرق بين:

assigned_at وaccepted_at

## response_time_minutes

الفرق بين:

created_at وstarted_at

## repair_time_minutes

الفرق بين:

started_at وcompleted_at

## total_resolution_time_minutes

الفرق بين:

created_at وclosed_at

لا يلزم تخزينها دائمًا في البداية.

يمكن حسابها باستخدام Views أو Queries.

---

# 29. العروض Views المقترحة

## open_tickets_view

تعرض الطلبات التي ليست:

- CLOSED
- CANCELLED

## overdue_tickets_view

تعرض:

- is_overdue = true
- والحالة ليست مغلقة أو ملغاة

## technician_performance_view

تعرض لكل فني:

- عدد الطلبات.
- المكتملة.
- المتأخرة.
- متوسط وقت الاستجابة.
- متوسط وقت الإصلاح.
- متوسط التقييم.

## asset_maintenance_summary_view

تعرض لكل جهاز:

- عدد الطلبات.
- عدد الطلبات المغلقة.
- آخر طلب.
- آخر صيانة.
- إجمالي تكلفة القطع.
- عدد مرات إعادة الفتح.

## location_summary_view

تعرض لكل موقع:

- عدد الأجهزة.
- عدد الطلبات المفتوحة.
- عدد المتأخرات.
- عدد الطلبات المغلقة.

---

# 30. تصميم Supabase Storage

## Bucket: ticket-attachments

الغرض:

- صور البلاغ.
- صور قبل الإصلاح.
- صور بعد الإصلاح.
- مستندات الطلب.

يجب أن يكون:

- Private.

مسار التخزين المقترح:

organization_id/ticket_id/attachment_type/file_name

مثال:

org-uuid/ticket-uuid/before-repair/image-uuid.webp

## Bucket: organization-assets

الغرض:

- شعارات الشركات.
- صور الأجهزة.
- صور المستخدمين عند الحاجة.

المسار المقترح:

organization_id/assets/file_name

## قواعد التخزين

1. المستخدم يرفع داخل مجلد شركته فقط.
2. المستخدم لا يفتح ملفات شركة أخرى.
3. الملفات العامة تعرض عبر Signed URL.
4. الروابط الموقعة لها مدة محدودة.
5. يتحقق النظام من النوع والحجم.
6. يمنع رفع الملفات التنفيذية.
7. لا يستخدم الاسم الأصلي وحده كاسم ملف.
8. يستخدم UUID للملف.

---

# 31. Row Level Security

يجب تفعيل RLS على جميع الجداول التشغيلية.

الجداول:

- organizations
- profiles
- user_locations
- locations
- categories
- assets
- tickets
- ticket_comments
- ticket_attachments
- ticket_history
- spare_parts_used
- ticket_ratings
- notifications
- organization_settings
- subscriptions
- notification_preferences

---

# 32. مفهوم سياسات RLS

## مدير الشركة

يمكنه رؤية وتعديل بيانات شركته.

## المشرف

يمكنه رؤية بيانات شركته والمواقع المرتبط بها.

## الفني

يمكنه رؤية:

- بيانات شركته.
- المواقع المسموحة.
- الطلبات المسندة إليه.
- بيانات الجهاز المرتبط بالطلب.

## المبلّغ العام

لا يستخدم جلسة مستخدم.

يصل فقط عبر:

- qr_token
- public_tracking_token

يجب تنفيذ العمليات العامة عبر Edge Functions أو RPC آمن.

## مدير المنصة

يصل عبر وظائف خادم محمية، وليس عبر سياسات واسعة داخل المتصفح.

---

# 33. قواعد RLS الأساسية

## organizations

المستخدم يرى شركته فقط.

SUPER_ADMIN يعالج الشركات من خلال وظائف خادم آمنة.

## profiles

المستخدم يرى ملفه.

مدير الشركة يرى مستخدمي شركته.

المشرف يرى المعلومات الضرورية فقط.

## locations

المستخدم يرى مواقع شركته المسموحة.

## assets

المستخدم يرى أجهزة شركته ضمن المواقع المسموحة.

## tickets

مدير الشركة يرى جميع طلبات الشركة.

المشرف يرى طلبات مواقعه.

الفني يرى طلباته أو طلبات مواقعه حسب السياسة.

## comments

المستخدم يرى التعليقات التابعة لطلبات يستطيع رؤيتها.

المبلّغ لا يرى is_internal = true.

## attachments

الوصول مرتبط بإمكانية رؤية الطلب.

## notifications

المستخدم يرى إشعاراته فقط.

## audit_logs

مدير الشركة قد يرى سجل شركته حسب الصلاحية.

الفني لا يرى سجل التدقيق العام.

---

# 34. العمليات العامة الآمنة

العمليات التالية لا تنفذ مباشرة من المتصفح إلى الجداول:

- إنشاء طلب من QR.
- متابعة الطلب بواسطة public_tracking_token.
- تقييم الخدمة.
- طلب إعادة فتح الطلب.
- إرسال تأكيد المبلّغ.
- إنشاء روابط Signed URL للمرفقات العامة.

تنفذ من خلال:

- Edge Functions.
- أو RPC Functions محمية.
- مع Rate Limiting.
- والتحقق من الرموز.

---

# 35. دوال قاعدة البيانات المقترحة

## generate_ticket_number

تنشئ رقم طلب فريدًا.

## create_public_ticket

تنشئ طلبًا من صفحة QR بعد التحقق.

## change_ticket_status

تغير الحالة وفق انتقالات مسموحة.

## assign_technician

تتحقق من الفني والشركة والموقع ثم تعيّنه.

## calculate_ticket_due_at

تحسب الموعد المتوقع.

## mark_overdue_tickets

تحدد الطلبات المتأخرة.

## close_ticket

تغلق الطلب وتحسب الأوقات.

## reopen_ticket

تعيد فتح الطلب وتزيد reopen_count.

## create_ticket_history_entry

تسجل حدثًا في التاريخ.

## update_asset_last_maintenance

تحدث آخر صيانة عند إغلاق الطلب.

---

# 36. الانتقالات المسموحة بين الحالات

يجب التحقق منها داخل الخادم أو قاعدة البيانات.

الانتقالات:

- NEW → ASSIGNED
- NEW → CANCELLED
- ASSIGNED → ACCEPTED
- ASSIGNED → NEW
- ASSIGNED → CANCELLED
- ACCEPTED → IN_PROGRESS
- ACCEPTED → ASSIGNED
- IN_PROGRESS → WAITING_PARTS
- IN_PROGRESS → PENDING_APPROVAL
- WAITING_PARTS → IN_PROGRESS
- PENDING_APPROVAL → IN_PROGRESS
- PENDING_APPROVAL → CLOSED
- CLOSED → REOPENED
- REOPENED → ASSIGNED
- REOPENED → IN_PROGRESS
- REOPENED → CANCELLED

أي انتقال آخر يرفض.

---

# 37. حماية التزامن والتكرار

يجب منع المشكلات التالية:

## تعيين فنيين في الوقت نفسه

استخدام Transaction أو شرط على الحالة الحالية.

## الضغط على الزر مرتين

يجب أن تكون العملية Idempotent قدر الإمكان.

## إنشاء رقم طلب مكرر

يستخدم Unique Constraint وتسلسل آمن.

## إرسال إشعار مرتين

يستخدم مفتاح event_key فريد اختياريًا.

يمكن إضافة حقل إلى notifications:

- event_key TEXT UNIQUE

مثال:

ticket-id:assigned:user-id

## إغلاق طلب مرتين

تتحقق الوظيفة من الحالة قبل التنفيذ.

---

# 38. بيانات تجريبية Seed Data

يجب إنشاء بيانات تجريبية للاختبار.

## شركة تجريبية

- شركة الواجهة لإدارة المرافق.

## المستخدمون

- مدير شركة.
- مشرف.
- فني تكييف.
- فني كهرباء.

## المواقع

- فرع الرياض.
- الطابق الأول.
- المستودع.

## التصنيفات

- تكييف.
- كهرباء.
- سباكة.
- شبكات.

## الأجهزة

- مكيف غرفة الاجتماعات.
- طابعة الإدارة.
- لوحة كهرباء.
- مضخة مياه.

## الطلبات

- طلب جديد.
- طلب معين.
- طلب جاري.
- طلب انتظار قطعة.
- طلب متأخر.
- طلب مغلق.

---

# 39. ترتيب إنشاء الجداول

يجب إنشاء الجداول بهذا الترتيب لتجنب أخطاء العلاقات:

1. أنواع ENUM.
2. organizations.
3. profiles.
4. locations.
5. user_locations.
6. categories.
7. assets.
8. organization_settings.
9. subscriptions.
10. tickets.
11. ticket_comments.
12. ticket_attachments.
13. ticket_history.
14. spare_parts_used.
15. ticket_ratings.
16. notifications.
17. notification_preferences.
18. audit_logs.
19. system_errors.
20. ticket_counters.
21. الفهارس.
22. Triggers.
23. Functions.
24. Views.
25. RLS.
26. Storage Buckets.
27. Storage Policies.
28. Cron Jobs.
29. Seed Data.

---

# 40. ملفات migrations المقترحة

يستخدم مجلد:

supabase/migrations/

الملفات:

- 001_create_enums.sql
- 002_create_organizations.sql
- 003_create_profiles.sql
- 004_create_locations.sql
- 005_create_user_locations.sql
- 006_create_categories.sql
- 007_create_assets.sql
- 008_create_organization_settings.sql
- 009_create_subscriptions.sql
- 010_create_tickets.sql
- 011_create_ticket_comments.sql
- 012_create_ticket_attachments.sql
- 013_create_ticket_history.sql
- 014_create_spare_parts_used.sql
- 015_create_ticket_ratings.sql
- 016_create_notifications.sql
- 017_create_notification_preferences.sql
- 018_create_audit_logs.sql
- 019_create_system_errors.sql
- 020_create_ticket_counters.sql
- 021_create_indexes.sql
- 022_create_triggers.sql
- 023_create_functions.sql
- 024_create_views.sql
- 025_enable_rls.sql
- 026_create_rls_policies.sql
- 027_create_storage_buckets.sql
- 028_create_storage_policies.sql
- 029_create_cron_jobs.sql
- 030_seed_demo_data.sql

---

# 41. قواعد التحقق من البيانات

## النصوص

- إزالة المسافات الزائدة.
- منع النصوص الفارغة.
- تحديد طول أقصى.
- منع HTML الخطر.
- ترميز المخرجات عند العرض.

## الأرقام

- الكميات أكبر من صفر.
- التكلفة لا تكون سالبة.
- التقييم بين 1 و5.
- أوقات الاستجابة لا تكون سالبة.

## التواريخ

- نهاية الاشتراك بعد بدايته.
- نهاية الضمان بعد الشراء.
- الإغلاق بعد الإنشاء.
- الإكمال بعد بدء العمل.
- القبول بعد التعيين.

## العلاقات

- المستخدم يتبع الشركة نفسها.
- الفني يتبع الشركة نفسها.
- الجهاز يتبع الموقع نفسه.
- الطلب يتبع الشركة والموقع الصحيحين.
- التصنيف يتبع الشركة نفسها.

---

# 42. قواعد الخصوصية

يجب عدم تخزين بيانات غير ضرورية.

البيانات المسموحة للمبلّغ:

- الاسم.
- رقم التواصل.
- البريد.
- وصف المشكلة.
- الصورة.

لا يجب جمع:

- رقم الهوية.
- بيانات مالية.
- معلومات شخصية غير مرتبطة بالخدمة.
- موقع دقيق دون حاجة.

يجب تحديد مدة الاحتفاظ ببيانات التواصل وفق سياسة الشركة.

---

# 43. النسخ الاحتياطي والاستعادة

يجب توثيق:

- تكرار النسخ الاحتياطي.
- مدة الاحتفاظ.
- مكان النسخ.
- طريقة الاستعادة.
- المسؤول عن الاستعادة.
- اختبار الاستعادة دوريًا.

يجب اختبار:

1. استعادة شركة.
2. استعادة طلب.
3. استعادة المرفقات.
4. استعادة الإعدادات.
5. استعادة العلاقات دون فقدان البيانات.

---

# 44. معايير اكتمال قاعدة البيانات

تعتبر قاعدة البيانات مكتملة عندما:

1. تم إنشاء جميع الجداول الأساسية.
2. تم إنشاء المفاتيح الخارجية.
3. تم إنشاء القيود.
4. تم إنشاء الفهارس.
5. تم تفعيل RLS.
6. تم إنشاء السياسات.
7. تم إنشاء Buckets.
8. تم حماية ملفات الشركات.
9. تم إنشاء دوال تغيير الحالة.
10. تم إنشاء رقم الطلب تلقائيًا.
11. تم اختبار عزل الشركات.
12. تم اختبار صلاحيات الأدوار.
13. تم اختبار إنشاء الطلب العام.
14. تم اختبار رفع المرفقات.
15. تم اختبار الطلبات المتأخرة.
16. تم اختبار التقارير الأساسية.
17. تم اختبار النسخ الاحتياطي.
18. لم تعد هناك أسرار داخل الكود.
19. تم إنشاء بيانات تجريبية.
20. تم توثيق جميع الجداول والعلاقات.
# FixFlow

نظام عربي متجاوب لإدارة وأتمتة طلبات الصيانة عبر رموز QR، مبني باستخدام React وVite وSupabase.

## الحالة الحالية

الإصدار `0.5.0` هو أساس MVP قابل للبناء والاختبار، ويشمل:

- لوحة تشغيل عربية متجاوبة.
- إنشاء الطلبات وعرضها والبحث والترشيح.
- تفاصيل الطلب والتعيين ومسار الحالات.
- نموذج صلاحيات وعزل متعدد الشركات.
- مخطط Supabase كامل مع RLS وStorage خاص.
- بيانات Development تجريبية.
- اختبارات وحدات وتكامل وأمن.
- إعداد SPA للنشر وCI.

الاتصال الحقيقي يحتاج مشروع Supabase ومفاتيحه العامة. البريد والمهام المجدولة يحتاجان أسرار الخادم المذكورة في `.env.example`.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env.local`.
2. أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY`.
3. نفّذ:

```bash
npm install
npm run dev
```

يفتح التطبيق افتراضيًا على `http://localhost:5173`.

## التحقق

```bash
npm run check
npm audit --omit=dev
```

## Supabase Development

بعد تثبيت Supabase CLI:

```bash
supabase start
supabase db reset
```

يطبّق الأمر ملفات `supabase/migrations` ثم `supabase/seed.sql`. بيانات Seed للتطوير والاختبار فقط ولا تُستخدم في Production.

## البيئات

| البيئة | البيانات | Supabase | الرابط |
|---|---|---|---|
| Development | تجريبية | مشروع تطوير مستقل | `http://localhost:5173` |
| Staging | تجريبية شبيهة بالإنتاج | مشروع مستقل | `https://staging.fixflow.sa` |
| Production | عملاء حقيقيون | مشروع إنتاج مستقل | `https://app.fixflow.sa` |

لا يجوز مشاركة قاعدة أو مفاتيح أو بيانات بين البيئات.

## الأسرار

- لا تضع Service Role أو Resend أو كلمة مرور قاعدة البيانات في متغير يبدأ بـ`VITE_`.
- احفظ أسرار الخادم في Supabase Secrets أو منصة الاستضافة.
- لا ترفع `.env*` أو النسخ الاحتياطية أو بيانات العملاء إلى Git.

## النشر

واجهة Vite تستخدم `npm run build` ومجلد الخرج `dist`. يحتوي `vercel.json` على إعادة كتابة SPA ورؤوس أمان أساسية. طبّق قاعدة البيانات والوظائف على Staging واختبر الرحلة كاملة قبل Production.

راجع:

- `docs/09-deployment.md`
- `docs/11-operations-runbook.md`
- `CHANGELOG.md`

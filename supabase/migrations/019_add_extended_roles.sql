-- =========================================================
-- FixFlow
-- Migration 019
-- إضافة الأدوار الجديدة إلى نوع user_role
-- =========================================================

alter type public.user_role
add value if not exists 'BRANCH_MANAGER';

alter type public.user_role
add value if not exists 'INVENTORY_MANAGER';

alter type public.user_role
add value if not exists 'REGISTERED_REPORTER';
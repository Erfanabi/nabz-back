-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('trial', 'purchase', 'admin_grant');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('expense', 'income', 'transfer');

-- CreateEnum
CREATE TYPE "SyncOpStatus" AS ENUM ('applied', 'duplicate', 'rejected', 'conflict');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(11) NOT NULL,
    "display_name" VARCHAR(80),
    "trial_used" BOOLEAN NOT NULL DEFAULT false,
    "deletion_scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(11) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "locked_until" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT,
    "platform" TEXT,
    "city" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "key" VARCHAR(20) NOT NULL,
    "title" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "is_purchasable" BOOLEAN NOT NULL DEFAULT false,
    "pitch" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" SERIAL NOT NULL,
    "plan_key" VARCHAR(20) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "amount_toman" INTEGER NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_limits" (
    "key" VARCHAR(60) NOT NULL,
    "label" TEXT NOT NULL,
    "free_value" INTEGER,
    "plus_value" INTEGER,
    "pro_value" INTEGER,
    "soon" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "key" VARCHAR(60) NOT NULL,
    "label" TEXT NOT NULL,
    "free_value" INTEGER NOT NULL DEFAULT 0,
    "plus_value" INTEGER NOT NULL DEFAULT 0,
    "pro_value" INTEGER NOT NULL DEFAULT 0,
    "soon" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "catalog_meta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "user_id" UUID NOT NULL,
    "plan_key" VARCHAR(20) NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "queued_entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_key" VARCHAR(20) NOT NULL,
    "source" "EntitlementSource" NOT NULL DEFAULT 'purchase',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queued_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_key" VARCHAR(20) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "amount_toman" INTEGER NOT NULL,
    "ref_code" VARCHAR(6) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual_card',
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" UUID,
    "reject_reason" TEXT,
    "queued" BOOLEAN,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "note" TEXT,
    "file_path" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "card_bin" VARCHAR(6),
    "card_last4" VARCHAR(4),
    "card_expiry" VARCHAR(5),
    "card_bank" TEXT,
    "card_tone" TEXT,
    "client_updated_at" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "client_updated_at" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "category_id" UUID,
    "account_id" UUID,
    "from_id" UUID,
    "to_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "client_updated_at" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "limit" INTEGER NOT NULL,
    "client_updated_at" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "months" INTEGER,
    "deadline" TIMESTAMP(3),
    "client_updated_at" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "recurrings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID,
    "account_id" UUID,
    "day_of_month" INTEGER,
    "every_months" INTEGER,
    "next_due_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "client_updated_at" BIGINT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrings_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "alert_reads" (
    "user_id" UUID NOT NULL,
    "alert_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "seq" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_reads_pkey" PRIMARY KEY ("user_id","alert_id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "calendar" TEXT NOT NULL DEFAULT 'jalali',
    "digits" TEXT NOT NULL DEFAULT 'fa',
    "week_start" TEXT NOT NULL DEFAULT 'sat',
    "report_chart" TEXT NOT NULL DEFAULT 'bars',
    "report_story" BOOLEAN NOT NULL DEFAULT false,
    "home_sections" JSONB NOT NULL DEFAULT '{"goals":false,"chart":false,"insights":false}',
    "auto_lock" INTEGER NOT NULL DEFAULT 60,
    "benchmarking" BOOLEAN NOT NULL DEFAULT false,
    "local_only" BOOLEAN NOT NULL DEFAULT false,
    "alerts" JSONB NOT NULL DEFAULT '{"budgetNear":true,"budgetOver":true,"spendingSpike":true,"recurringDue":true,"balanceDrop":true,"goalBehind":true,"savingRateDown":false}',
    "quiet_hours" BOOLEAN NOT NULL DEFAULT true,
    "quiet_from" VARCHAR(5) NOT NULL DEFAULT '22:00',
    "quiet_to" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "device_push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "app_version" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_ops" (
    "user_id" UUID NOT NULL,
    "op_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "SyncOpStatus" NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_ops_pkey" PRIMARY KEY ("user_id","op_id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "seq" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "route" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "bucket" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("bucket")
);

-- CreateTable
CREATE TABLE "job_locks" (
    "name" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_locks_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_created_at_idx" ON "otp_challenges"("phone", "created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plan_prices_plan_key_duration_days_key" ON "plan_prices"("plan_key", "duration_days");

-- CreateIndex
CREATE INDEX "queued_entitlements_user_id_starts_at_idx" ON "queued_entitlements"("user_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_ref_code_key" ON "payment_requests"("ref_code");

-- CreateIndex
CREATE INDEX "payment_requests_user_id_status_idx" ON "payment_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "payment_requests_status_created_at_idx" ON "payment_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_receipts_request_id_idx" ON "payment_receipts"("request_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_seq_idx" ON "accounts"("user_id", "seq");

-- CreateIndex
CREATE INDEX "categories_user_id_seq_idx" ON "categories"("user_id", "seq");

-- CreateIndex
CREATE INDEX "transactions_user_id_seq_idx" ON "transactions"("user_id", "seq");

-- CreateIndex
CREATE INDEX "transactions_user_id_occurred_at_idx" ON "transactions"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "budgets_user_id_seq_idx" ON "budgets"("user_id", "seq");

-- CreateIndex
CREATE INDEX "goals_user_id_seq_idx" ON "goals"("user_id", "seq");

-- CreateIndex
CREATE INDEX "recurrings_user_id_seq_idx" ON "recurrings"("user_id", "seq");

-- CreateIndex
CREATE INDEX "alert_reads_user_id_seq_idx" ON "alert_reads"("user_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "device_push_tokens_user_id_device_id_key" ON "device_push_tokens"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "change_log_user_id_seq_idx" ON "change_log"("user_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_route_user_id_key" ON "idempotency_keys"("key", "route", "user_id");

-- CreateIndex
CREATE INDEX "rate_limit_counters_expires_at_idx" ON "rate_limit_counters"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_key_fkey" FOREIGN KEY ("plan_key") REFERENCES "plans"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queued_entitlements" ADD CONSTRAINT "queued_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_category_id_fkey" FOREIGN KEY ("user_id", "category_id") REFERENCES "categories"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_account_id_fkey" FOREIGN KEY ("user_id", "account_id") REFERENCES "accounts"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_from_id_fkey" FOREIGN KEY ("user_id", "from_id") REFERENCES "accounts"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_to_id_fkey" FOREIGN KEY ("user_id", "to_id") REFERENCES "accounts"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_category_id_fkey" FOREIGN KEY ("user_id", "category_id") REFERENCES "categories"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrings" ADD CONSTRAINT "recurrings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrings" ADD CONSTRAINT "recurrings_user_id_category_id_fkey" FOREIGN KEY ("user_id", "category_id") REFERENCES "categories"("user_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_reads" ADD CONSTRAINT "alert_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_ops" ADD CONSTRAINT "sync_ops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- BR-01 در سطح دیتابیس
--
-- انتقال بین حساب‌های خودِ کاربر نه درآمد است نه هزینه: category و account ندارد
-- و در عوض from و to دارد. برعکسش هم درست است. اجبار کردن این قاعده در کد کافی
-- نیست — یک مسیر نوشتنِ آیندهٔ بی‌دقت یا یک اسکریپت دستی می‌تواند دادهٔ ناسازگار
-- بسازد که بعد در هر جمعی دو بار یا اشتباه شمرده می‌شود.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shape_matches_type" CHECK (
  (
    "type" = 'transfer'
    AND "from_id" IS NOT NULL
    AND "to_id" IS NOT NULL
    AND "from_id" <> "to_id"
    AND "category_id" IS NULL
    AND "account_id" IS NULL
  )
  OR (
    "type" IN ('expense', 'income')
    AND "from_id" IS NULL
    AND "to_id" IS NULL
    AND "category_id" IS NOT NULL
    AND "account_id" IS NOT NULL
  )
);

-- پول همیشه عدد صحیح و نامنفی به تومان است (TECH_STACK §۳).
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_limit_non_negative" CHECK ("limit" >= 0);
ALTER TABLE "goals" ADD CONSTRAINT "goals_target_positive" CHECK ("target" > 0 AND "current" >= 0);
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_amount_non_negative" CHECK ("amount_toman" >= 0);
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_amount_non_negative" CHECK ("amount_toman" >= 0);

-- فقط چهار رقم آخر و شش رقم اول کارت ذخیره می‌شود؛ PAN کامل جا نمی‌شود (NFR-10).
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_card_last4_shape" CHECK ("card_last4" IS NULL OR "card_last4" ~ '^[0-9]{4}$');
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_card_bin_shape" CHECK ("card_bin" IS NULL OR "card_bin" ~ '^[0-9]{6}$');

-- شماره موبایل همیشه نرمال‌شده ذخیره می‌شود (09xxxxxxxxx).
ALTER TABLE "users" ADD CONSTRAINT "users_phone_normalized" CHECK ("phone" ~ '^09[0-39][0-9]{8}$');

-- ساعت آرام با ارقام لاتین و قالب HH:mm (API-SPEC §۷.۱).
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_quiet_from_shape" CHECK ("quiet_from" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_quiet_to_shape" CHECK ("quiet_to" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- کد پیگیری: ۶ کاراکتر از الفبای بدون 0/O و 1/I/L.
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_ref_code_alphabet" CHECK ("ref_code" ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$');

-- دورهٔ اشتراک نمی‌تواند پیش از شروعش تمام شود.
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_period_ordered" CHECK ("expires_at" IS NULL OR "expires_at" > "starts_at");
ALTER TABLE "queued_entitlements" ADD CONSTRAINT "queued_entitlements_period_ordered" CHECK ("expires_at" > "starts_at");

import { HttpException } from '@nestjs/common';

/**
 * کدهای خطا طبق API-SPEC §۲.۴.
 * `code` ماشین‌خوان و ثابت است — کلاینت روی آن شرط می‌گذارد نه روی message.
 * `message` فارسی، انسانی و قابل نمایش مستقیم به کاربر است؛ «field required» قابل قبول نیست.
 */
export type ErrorCode =
  | 'otp_invalid'
  | 'otp_expired'
  | 'otp_locked'
  | 'phone_invalid'
  | 'rate_limited'
  | 'token_expired'
  | 'token_revoked'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'plan_limit_reached'
  | 'feature_not_available'
  | 'payment_request_expired'
  | 'trial_already_used'
  | 'sync_conflict'
  | 'cursor_expired'
  | 'payload_too_large'
  | 'server_error';

interface ErrorDef {
  status: number;
  message: string;
  messageEn: string;
}

export const ERROR_CATALOG: Record<ErrorCode, ErrorDef> = {
  otp_invalid: {
    status: 401,
    message: 'کد وارد شده درست نیست.',
    messageEn: 'Invalid code.',
  },
  otp_expired: {
    status: 410,
    message: 'مدت اعتبار کد تمام شده. کد تازه بگیر.',
    messageEn: 'Code expired.',
  },
  otp_locked: {
    status: 423,
    message: 'تلاش‌های بیش از حد. کمی بعد دوباره امتحان کن.',
    messageEn: 'Too many attempts. Temporarily locked.',
  },
  phone_invalid: {
    status: 400,
    message: 'شماره موبایل درست نیست. یک شماره موبایل ایران وارد کن.',
    messageEn: 'Invalid mobile number.',
  },
  rate_limited: {
    status: 429,
    message: 'درخواست‌ها بیش از حد زیاد بود. کمی بعد دوباره امتحان کن.',
    messageEn: 'Too many requests.',
  },
  token_expired: {
    status: 401,
    message: 'نشست تو تمام شده. دوباره وارد شو.',
    messageEn: 'Token expired.',
  },
  token_revoked: {
    status: 401,
    message: 'این نشست بسته شده. دوباره وارد شو.',
    messageEn: 'Token revoked.',
  },
  unauthorized: {
    status: 401,
    message: 'برای این کار باید وارد شده باشی.',
    messageEn: 'Unauthorized.',
  },
  forbidden: {
    status: 403,
    message: 'اجازهٔ این کار را نداری.',
    messageEn: 'Forbidden.',
  },
  not_found: {
    status: 404,
    message: 'چیزی که دنبالش بودی پیدا نشد.',
    messageEn: 'Not found.',
  },
  validation_failed: {
    status: 422,
    message: 'اطلاعات فرستاده‌شده کامل یا درست نیست.',
    messageEn: 'Validation failed.',
  },
  plan_limit_reached: {
    status: 403,
    message: 'به سقف پلن فعلی رسیدی. برای بیشتر، پلن را ارتقا بده.',
    messageEn: 'Plan limit reached.',
  },
  feature_not_available: {
    status: 403,
    message: 'این قابلیت در پلن فعلی تو نیست.',
    messageEn: 'Feature not available on your plan.',
  },
  payment_request_expired: {
    status: 410,
    message: 'مهلت این درخواست پرداخت تمام شده. درخواست تازه بساز.',
    messageEn: 'Payment request expired.',
  },
  trial_already_used: {
    status: 409,
    message: 'دورهٔ آزمایشی قبلاً برای این شماره استفاده شده.',
    messageEn: 'Trial already used.',
  },
  sync_conflict: {
    status: 409,
    message: 'نسخهٔ تازه‌تری از این اطلاعات روی سرور هست.',
    messageEn: 'Sync conflict.',
  },
  cursor_expired: {
    status: 410,
    message: 'نشانگر همگام‌سازی کهنه شده. اطلاعات از ابتدا گرفته می‌شود.',
    messageEn: 'Sync cursor expired.',
  },
  payload_too_large: {
    status: 413,
    message: 'حجم اطلاعات فرستاده‌شده بیش از حد مجاز است.',
    messageEn: 'Payload too large.',
  },
  server_error: {
    status: 500,
    message: 'مشکلی در سرور پیش آمد. کمی بعد دوباره امتحان کن.',
    messageEn: 'Server error.',
  },
};

export interface AppErrorOptions {
  /** پیام فارسی جایگزین — وقتی بافت خاصی لازم است (مثلاً نام سقفی که پر شده). */
  message?: string;
  messageEn?: string;
  /** خطای هر فیلد، فارسی. */
  fields?: Record<string, string>;
  /** ثانیه — روی ۴۲۹ و روی قفل OTP. */
  retryAfter?: number;
  /** بار اضافهٔ مخصوص هر خطا (مثلاً server_version در تعارض). */
  extra?: Record<string, unknown>;
}

export class AppError extends HttpException {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;
  readonly extra?: Record<string, unknown>;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const def = ERROR_CATALOG[code];
    super(
      {
        code,
        message: options.message ?? def.message,
        message_en: options.messageEn ?? def.messageEn,
        ...(options.fields ? { fields: options.fields } : {}),
        ...(options.retryAfter !== undefined ? { retry_after: options.retryAfter } : {}),
        ...(options.extra ?? {}),
      },
      def.status,
    );
    this.code = code;
    this.fields = options.fields;
    this.retryAfter = options.retryAfter;
    this.extra = options.extra;
  }
}

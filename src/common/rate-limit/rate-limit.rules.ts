import { RateLimitRule } from './rate-limit.service';

/** سقف‌های API-SPEC §۲.۵. */
export const RATE_LIMITS = {
  /** ۳ بار در ۱۰ دقیقه بر شماره */
  otpRequestPhone: { name: 'otp_req_phone', limit: 3, windowSeconds: 600 } as RateLimitRule,
  /** ۱۰ بار در ساعت بر IP */
  otpRequestIp: { name: 'otp_req_ip', limit: 10, windowSeconds: 3600 } as RateLimitRule,
  /** ۶۰ بار در دقیقه بر کاربر */
  syncPush: { name: 'sync_push', limit: 60, windowSeconds: 60 } as RateLimitRule,
  /** بقیه: ۱۲۰ بار در دقیقه بر کاربر */
  general: { name: 'general', limit: 120, windowSeconds: 60 } as RateLimitRule,
  /** ورود ادمین — سند سقف نداده، اما مسیر رمز عبور بدون سقف امن نیست. */
  adminLogin: { name: 'admin_login', limit: 10, windowSeconds: 600 } as RateLimitRule,
} as const;

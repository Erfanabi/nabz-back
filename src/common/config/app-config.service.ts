import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** دسترسی تایپ‌دار به تنظیمات محیطی — تا هیچ‌جای کد رشتهٔ env نخواند. */
@Injectable()
export class AppConfigService {
  constructor(private readonly env: ConfigService) {}

  private num(key: string, fallback: number): number {
    const raw = this.env.get<string>(key);
    const n = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  private bool(key: string, fallback: boolean): boolean {
    const raw = this.env.get<string>(key);
    if (raw === undefined || raw === '') return fallback;
    return raw === 'true' || raw === '1';
  }

  private str(key: string, fallback = ''): string {
    return this.env.get<string>(key) ?? fallback;
  }

  get isProduction(): boolean {
    return this.str('NODE_ENV', 'development') === 'production';
  }

  get port(): number {
    return this.num('PORT', 3000);
  }

  get swaggerEnabled(): boolean {
    return this.bool('SWAGGER_ENABLED', !this.isProduction);
  }

  // ---- توکن ----
  get accessSecret(): string {
    return this.str('JWT_ACCESS_SECRET');
  }
  get refreshSecret(): string {
    return this.str('JWT_REFRESH_SECRET');
  }
  get adminSecret(): string {
    return this.str('JWT_ADMIN_SECRET');
  }
  get fileUrlSecret(): string {
    return this.str('FILE_URL_SECRET');
  }
  get accessTtlSeconds(): number {
    return this.num('ACCESS_TOKEN_TTL_SECONDS', 900);
  }
  get refreshTtlSeconds(): number {
    return this.num('REFRESH_TOKEN_TTL_SECONDS', 2_592_000);
  }

  // ---- OTP ----
  get otpLength(): number {
    return this.num('OTP_LENGTH', 6);
  }
  get otpTtlSeconds(): number {
    return this.num('OTP_TTL_SECONDS', 120);
  }
  get otpResendAfterSeconds(): number {
    return this.num('OTP_RESEND_AFTER_SECONDS', 60);
  }
  get otpMaxAttempts(): number {
    return this.num('OTP_MAX_ATTEMPTS', 5);
  }
  get otpLockMinutes(): number {
    return this.num('OTP_LOCK_MINUTES', 15);
  }
  /** کف زمان پاسخ otp/request — تا زمان پاسخ نشان ندهد شماره ثبت بود یا نه. */
  get otpRequestMinMs(): number {
    return this.num('OTP_REQUEST_MIN_MS', 250);
  }

  // ---- SMS ----
  get smsDriver(): string {
    return this.str('SMS_DRIVER', 'log');
  }
  get smsSender(): string {
    return this.str('SMS_SENDER');
  }
  get kavenegarApiKey(): string {
    return this.str('KAVENEGAR_API_KEY');
  }
  get kavenegarTemplate(): string {
    return this.str('KAVENEGAR_TEMPLATE', 'nabz-otp');
  }
  get smsirApiKey(): string {
    return this.str('SMSIR_API_KEY');
  }
  get smsirTemplateId(): string {
    return this.str('SMSIR_TEMPLATE_ID');
  }

  // ---- پرداخت کارت‌به‌کارت ----
  get billingConfig() {
    return {
      card_number: this.str('BILLING_CARD_NUMBER'),
      card_holder: this.str('BILLING_CARD_HOLDER'),
      receipt_contact_phone: this.str('BILLING_RECEIPT_PHONE'),
      receipt_channels: this.str('BILLING_RECEIPT_CHANNELS', 'sms,telegram,whatsapp')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      payment_providers: ['manual_card'],
      trial_days: this.trialDays,
      request_ttl_hours: this.requestTtlHours,
    };
  }
  get trialDays(): number {
    return this.num('BILLING_TRIAL_DAYS', 30);
  }
  get requestTtlHours(): number {
    return this.num('BILLING_REQUEST_TTL_HOURS', 72);
  }
  get entitlementGraceDays(): number {
    return this.num('ENTITLEMENT_GRACE_DAYS', 7);
  }
  get accountDeletionGraceDays(): number {
    return this.num('ACCOUNT_DELETION_GRACE_DAYS', 7);
  }

  // ---- کانفیگ عمومی اپ ----
  get appRuntimeConfig() {
    return {
      min_supported_version: this.str('MIN_SUPPORTED_VERSION', '1.0.0'),
      force_update: this.bool('FORCE_UPDATE', false),
      update_url: this.str('UPDATE_URL'),
      support_phone: this.str('SUPPORT_PHONE'),
      sync_enabled: this.bool('SYNC_ENABLED', true),
      otp_length: this.otpLength,
      entitlement_grace_days: this.entitlementGraceDays,
    };
  }

  // ---- استوریج ----
  get storageDir(): string {
    return this.str('STORAGE_DIR', './storage');
  }
  get signedUrlTtlSeconds(): number {
    return this.num('SIGNED_URL_TTL_SECONDS', 900);
  }
  get publicBaseUrl(): string {
    return this.str('PUBLIC_BASE_URL', `http://localhost:${this.port}`);
  }

  // ---- Push ----
  get pushEnabled(): boolean {
    return this.bool('PUSH_ENABLED', true);
  }
  get expoPushUrl(): string {
    return this.str('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send');
  }
  get expoAccessToken(): string {
    return this.str('EXPO_ACCESS_TOKEN');
  }
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * لایهٔ انتزاعی پیامک.
 *
 * درایور با متغیر محیطی `SMS_DRIVER` عوض می‌شود؛ هیچ‌جای منطق احراز هویت نمی‌داند
 * پیامک از کجا می‌رود. در توسعه درایور `log` فعال است و کد را در لاگ چاپ می‌کند.
 */
export interface SmsProvider {
  readonly name: string;
  /** کد یک‌بارمصرف را می‌فرستد. هیچ‌وقت خطای فرستنده به کاربر برنمی‌گردد. */
  sendOtp(phone: string, code: string): Promise<void>;
}

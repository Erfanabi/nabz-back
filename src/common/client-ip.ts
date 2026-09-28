import { Request } from 'express';

/**
 * IP واقعی کلاینت.
 *
 * وقتی سرور پشت پروکسی ایرانی است، `X-Forwarded-For` تنها منبع IP واقعی است؛
 * اما فقط زمانی به آن اعتماد می‌شود که `TRUST_PROXY` روشن باشد — وگرنه هر کلاینتی
 * می‌تواند با جعل این هدر از محدودیت نرخ رد شود.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const fwd = req.headers['x-forwarded-for'];
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    const first = raw?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

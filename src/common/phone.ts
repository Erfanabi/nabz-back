/**
 * نرمال‌سازی شماره موبایل ایران به شکل `09xxxxxxxxx`.
 *
 * کاربر شماره را در هر قالبی می‌زند: `+98`، `0098`، `98`، ارقام فارسی یا عربی،
 * با فاصله، خط تیره یا خط تیرهٔ فارسی. کلاینت خودش نرمال می‌کند، اما اعتبارسنجی
 * واقعی کار سرور است و کلاینت هیچ‌وقت مرجع نیست (BACKEND-SPEC §۳.۲).
 *
 * خط ثابت رد می‌شود چون پیامک به آن نمی‌رسد.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** ارقام فارسی/عربی را به لاتین تبدیل می‌کند. */
export function toLatinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const fa = PERSIAN_DIGITS.indexOf(ch);
    if (fa !== -1) {
      out += String(fa);
      continue;
    }
    const ar = ARABIC_DIGITS.indexOf(ch);
    if (ar !== -1) {
      out += String(ar);
      continue;
    }
    out += ch;
  }
  return out;
}

/** پیش‌شمارهٔ مجاز موبایل ایران — همان قاعدهٔ کلاینت. */
export const IRAN_MOBILE_RE = /^09[0-39]\d{8}$/;

/**
 * شماره را نرمال می‌کند و در صورت نامعتبر بودن `null` می‌دهد.
 * هیچ خطایی نمی‌اندازد تا فراخواننده تصمیم بگیرد چه کدی برگرداند.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;

  // ارقام غیرلاتین، جداکننده‌ها و نویسه‌های کنترل جهت متن (RTL) حذف می‌شوند.
  let s = toLatinDigits(raw)
    .replace(/[‌‎‏‪-‮]/g, '')
    .replace(/[\s\-‐-―_().]/g, '');

  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = s.slice(2);

  if (/^9\d{9}$/.test(s)) s = `0${s}`;

  if (!/^\d{11}$/.test(s)) return null;
  if (!IRAN_MOBILE_RE.test(s)) return null;
  return s;
}

/** شمارهٔ ماسک‌شده برای لاگ — لاگ‌ها شمارهٔ کامل ندارند (API-SPEC §۱۰ بند ۷). */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}

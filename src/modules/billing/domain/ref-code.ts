import { randomInt } from 'node:crypto';

/**
 * الفبای کد پیگیری — عمداً بدون `0/O` و `1/I/L` (BACKEND-SPEC §۳.۵).
 * کاربر باید کد را از روی صفحه بخواند و تایپ کند، پس نویسه‌های شبیه‌هم حذف شده‌اند.
 */
export const REF_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const REF_CODE_LENGTH = 6;

/** یک کد پیگیری ۶ کاراکتری با تصادف رمزنگاری‌شده می‌سازد. */
export function generateRefCode(): string {
  let code = '';
  for (let i = 0; i < REF_CODE_LENGTH; i += 1) {
    code += REF_CODE_ALPHABET[randomInt(REF_CODE_ALPHABET.length)];
  }
  return code;
}

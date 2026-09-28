/**
 * `sync_cursor` — نشانگر موقعیت کلاینت در جریان تغییرات.
 *
 * مقدار پشت آن `seq` جدول تغییرات است. قالب متنی (`c_000871`) همان چیزی است که
 * سند نشان می‌دهد و عمداً برای کلاینت مات است: کلاینت آن را فقط ذخیره و پس
 * می‌فرستد، پس بعداً می‌شود پیاده‌سازی را عوض کرد بدون شکستن اپ منتشرشده.
 */
const PREFIX = 'c_';

export function encodeCursor(seq: bigint | number): string {
  return `${PREFIX}${String(seq).padStart(6, '0')}`;
}

/** `null` = نشانگر نامعتبر (فراخواننده باید `cursor_expired` بدهد). */
export function decodeCursor(cursor: string | undefined | null): bigint | null {
  if (cursor === undefined || cursor === null || cursor === '') return 0n;
  if (!cursor.startsWith(PREFIX)) return null;
  const digits = cursor.slice(PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

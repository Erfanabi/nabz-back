/**
 * ساعت آرام — به **وقت محلی کاربر**، نه وقت سرور (API-SPEC §۸.۳).
 *
 * توابع خالص تا رفتار مرزی (بازهٔ شبانه که از نیمه‌شب می‌گذرد) قابل تست باشد.
 */

/** `HH:mm` را به دقیقه از نیمه‌شب تبدیل می‌کند. */
export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** دقیقهٔ روز در یک منطقهٔ زمانی مشخص. */
export function localMinutes(now: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    // برخی محیط‌ها نیمه‌شب را 24 می‌دهند.
    return (hour % 24) * 60 + minute;
  } catch {
    // منطقهٔ زمانی نامعتبر: ساعت آرام اعمال نمی‌شود، چون بی‌صدا کردنِ اشتباهِ
    // یک هشدار مالی بدتر از فرستادن آن است.
    return -1;
  }
}

/**
 * آیا همین حالا در ساعت آرام هستیم؟
 *
 * بازه می‌تواند از نیمه‌شب بگذرد (۲۲:۰۰ تا ۰۸:۰۰) که حالت پیش‌فرض است.
 */
export function isQuietNow(
  now: Date,
  settings: { quietHours: boolean; quietFrom: string; quietTo: string; timezone: string },
): boolean {
  if (!settings.quietHours) return false;

  const current = localMinutes(now, settings.timezone);
  if (current < 0) return false;

  const from = minutesOfDay(settings.quietFrom);
  const to = minutesOfDay(settings.quietTo);

  if (from === to) return false; // بازهٔ صفر یعنی ساعت آرامی وجود ندارد.
  if (from < to) return current >= from && current < to;
  return current >= from || current < to; // بازهٔ شبانه
}

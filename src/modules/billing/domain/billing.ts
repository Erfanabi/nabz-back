/**
 * موتور اشتراک — توابع خالص، بدون دیتابیس و بدون زمان سیستم.
 *
 * مرجع: API-SPEC §۵.۱۰ و BACKEND-SPEC §۵.۵.
 * قاعده در یک جمله: **ارتقا فوری، تمدید یا تنزل صف‌شده** — روز پولی کاربر هدر نمی‌رود.
 *
 * زمان همیشه به صورت epoch ms و از بیرون تزریق می‌شود (ساعت سرور)، تا عوض کردن
 * تاریخ گوشی نتواند دوره را کِش بدهد.
 */

export const DAY_MS = 86_400_000;

export interface PlanTierLookup {
  /** tier پلن؛ اگر پلن ناشناس بود -۱ برگردد. */
  (planKey: string): number;
}

export interface CurrentEntitlement {
  planKey: string;
  /** null = بی‌انقضا (پلن رایگان). */
  expiresAt: number | null;
}

export interface ApprovalInput {
  /** پلنی که خریداری شده. */
  planKey: string;
  durationDays: number;
  /** وضعیت فعلی کاربر. */
  current: CurrentEntitlement;
  /** ساعت سرور. */
  nowMs: number;
  tierOf: PlanTierLookup;
}

export interface ApprovalDecision {
  /** آیا دورهٔ خریداری‌شده پشت دورهٔ فعلی صف می‌شود؟ */
  queued: boolean;
  startsAt: number;
  endsAt: number;
}

/**
 * تصمیم تأیید یک پرداخت.
 *
 * پلن بالاتر از پلن فعال → فوراً شروع می‌شود.
 * پلن هم‌سطح یا پایین‌تر و دورهٔ فعلی هنوز فعال → پشت دورهٔ فعلی صف می‌شود.
 */
export function decideApproval(input: ApprovalInput): ApprovalDecision {
  const { planKey, durationDays, current, nowMs, tierOf } = input;

  const tierBuying = tierOf(planKey);
  const tierCurrent = tierOf(current.planKey);

  // دورهٔ بی‌انقضا (رایگان) هیچ‌وقت «دورهٔ پولی فعال» نیست و چیزی برای حفظ ندارد.
  const activeNow = current.expiresAt !== null && current.expiresAt > nowMs;

  const queued = activeNow && tierCurrent >= tierBuying;
  const startsAt = queued ? (current.expiresAt as number) : nowMs;
  const endsAt = startsAt + durationDays * DAY_MS;

  return { queued, startsAt, endsAt };
}

export interface EffectivePlanInput {
  /** ردیف فعال ذخیره‌شده. */
  active: { planKey: string; expiresAt: number | null } | null;
  /** دوره‌های صف‌شده، به هر ترتیبی. */
  queued: Array<{ planKey: string; startsAt: number; expiresAt: number }>;
  nowMs: number;
  /** مهلت لطف برای حالت آفلاین — فقط کلاینت از آن استفاده می‌کند؛ اینجا صفر است. */
  graceDays?: number;
}

export interface EffectivePlanResult {
  planKey: string;
  expiresAt: number | null;
  /** دوره‌هایی که هنوز نرسیده‌اند و باید در پاسخ entitlements بیایند. */
  stillQueued: Array<{ planKey: string; startsAt: number; expiresAt: number }>;
  /** دوره‌ای که باید به ردیف فعال ارتقا پیدا کند (صفش رسیده). */
  promote: { planKey: string; startsAt: number; expiresAt: number } | null;
}

/**
 * پلن مؤثر را از ردیف فعال و صف حساب می‌کند.
 *
 * اگر دورهٔ فعال تمام شده باشد و دورهٔ صف‌شده‌ای رسیده باشد، آن دوره فعال می‌شود.
 * اگر هیچ دورهٔ معتبری نبود، پلن `free` بدون انقضا — نه خطا، نه حالت قفل.
 */
export function resolveEffectivePlan(input: EffectivePlanInput): EffectivePlanResult {
  const { active, queued, nowMs } = input;
  const graceMs = (input.graceDays ?? 0) * DAY_MS;

  const activeValid =
    active !== null && (active.expiresAt === null || active.expiresAt + graceMs > nowMs);

  if (activeValid) {
    return {
      planKey: active!.planKey,
      expiresAt: active!.expiresAt,
      stillQueued: [...queued].sort((a, b) => a.startsAt - b.startsAt),
      promote: null,
    };
  }

  // دورهٔ فعال تمام شده: اولین دورهٔ صف‌شده‌ای که هنوز منقضی نشده جای آن را می‌گیرد.
  const sorted = [...queued].sort((a, b) => a.startsAt - b.startsAt);
  const next = sorted.find((q) => q.expiresAt + graceMs > nowMs);

  if (!next) {
    return { planKey: 'free', expiresAt: null, stillQueued: [], promote: null };
  }

  return {
    planKey: next.planKey,
    expiresAt: next.expiresAt,
    stillQueued: sorted.filter((q) => q !== next),
    promote: next,
  };
}

/** سقف پلن: `null` = نامحدود، `0` = بسته. */
export function isWithinLimit(limit: number | null, currentUsage: number): boolean {
  if (limit === null) return true;
  return currentUsage < limit;
}

/** آیا قابلیت در این پلن باز است؟ (`1` باز، `0` بسته) */
export function isFeatureEnabled(value: number | undefined): boolean {
  return value === 1;
}

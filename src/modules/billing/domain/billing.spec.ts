import {
  DAY_MS,
  decideApproval,
  resolveEffectivePlan,
  isWithinLimit,
  isFeatureEnabled,
} from './billing';
import { REF_CODE_ALPHABET, generateRefCode } from './ref-code';

const TIERS: Record<string, number> = { free: 0, plus: 1, pro: 2 };
const tierOf = (key: string) => TIERS[key] ?? -1;

const NOW = 1_735_000_000_000;

describe('decideApproval — ارتقا فوری، تمدید/تنزل صف‌شده', () => {
  it('ارتقا از پلاس به پرو فوراً شروع می‌شود', () => {
    const d = decideApproval({
      planKey: 'pro',
      durationDays: 30,
      current: { planKey: 'plus', expiresAt: NOW + 20 * DAY_MS },
      nowMs: NOW,
      tierOf,
    });
    expect(d.queued).toBe(false);
    expect(d.startsAt).toBe(NOW);
    expect(d.endsAt).toBe(NOW + 30 * DAY_MS);
  });

  it('تمدید همان پلن پشت دورهٔ فعلی صف می‌شود تا روز پولی هدر نرود', () => {
    const currentEnd = NOW + 20 * DAY_MS;
    const d = decideApproval({
      planKey: 'plus',
      durationDays: 90,
      current: { planKey: 'plus', expiresAt: currentEnd },
      nowMs: NOW,
      tierOf,
    });
    expect(d.queued).toBe(true);
    expect(d.startsAt).toBe(currentEnd);
    expect(d.endsAt).toBe(currentEnd + 90 * DAY_MS);
  });

  it('تنزل از پرو به پلاس صف می‌شود، نه اینکه پرو را قطع کند', () => {
    const currentEnd = NOW + 10 * DAY_MS;
    const d = decideApproval({
      planKey: 'plus',
      durationDays: 30,
      current: { planKey: 'pro', expiresAt: currentEnd },
      nowMs: NOW,
      tierOf,
    });
    expect(d.queued).toBe(true);
    expect(d.startsAt).toBe(currentEnd);
  });

  it('خرید روی پلن رایگانِ بی‌انقضا فوری است، چون دورهٔ پولی برای حفظ وجود ندارد', () => {
    const d = decideApproval({
      planKey: 'plus',
      durationDays: 30,
      current: { planKey: 'free', expiresAt: null },
      nowMs: NOW,
      tierOf,
    });
    expect(d.queued).toBe(false);
    expect(d.startsAt).toBe(NOW);
  });

  it('خرید بعد از پایان دورهٔ قبلی فوری است، حتی برای همان پلن', () => {
    const d = decideApproval({
      planKey: 'plus',
      durationDays: 30,
      current: { planKey: 'plus', expiresAt: NOW - 1 },
      nowMs: NOW,
      tierOf,
    });
    expect(d.queued).toBe(false);
    expect(d.startsAt).toBe(NOW);
  });

  it('در مرز دقیق انقضا، دوره تمام‌شده حساب می‌شود (expires_at > now)', () => {
    const exact = decideApproval({
      planKey: 'plus',
      durationDays: 30,
      current: { planKey: 'plus', expiresAt: NOW },
      nowMs: NOW,
      tierOf,
    });
    expect(exact.queued).toBe(false);

    const oneMsLater = decideApproval({
      planKey: 'plus',
      durationDays: 30,
      current: { planKey: 'plus', expiresAt: NOW + 1 },
      nowMs: NOW,
      tierOf,
    });
    expect(oneMsLater.queued).toBe(true);
  });
});

describe('resolveEffectivePlan', () => {
  it('دورهٔ فعالِ معتبر را برمی‌گرداند و صف را دست نمی‌زند', () => {
    const r = resolveEffectivePlan({
      active: { planKey: 'pro', expiresAt: NOW + DAY_MS },
      queued: [{ planKey: 'plus', startsAt: NOW + DAY_MS, expiresAt: NOW + 31 * DAY_MS }],
      nowMs: NOW,
    });
    expect(r.planKey).toBe('pro');
    expect(r.promote).toBeNull();
    expect(r.stillQueued).toHaveLength(1);
  });

  it('با پایان دورهٔ فعال، دورهٔ صف‌شده ارتقا می‌یابد', () => {
    const start = NOW - DAY_MS;
    const r = resolveEffectivePlan({
      active: { planKey: 'pro', expiresAt: NOW - DAY_MS },
      queued: [{ planKey: 'plus', startsAt: start, expiresAt: NOW + 29 * DAY_MS }],
      nowMs: NOW,
    });
    expect(r.planKey).toBe('plus');
    expect(r.promote?.planKey).toBe('plus');
    expect(r.stillQueued).toHaveLength(0);
  });

  it('وقتی هیچ دورهٔ معتبری نیست به رایگان برمی‌گردد، نه به خطا', () => {
    const r = resolveEffectivePlan({
      active: { planKey: 'plus', expiresAt: NOW - DAY_MS },
      queued: [{ planKey: 'plus', startsAt: NOW - 40 * DAY_MS, expiresAt: NOW - 10 * DAY_MS }],
      nowMs: NOW,
    });
    expect(r.planKey).toBe('free');
    expect(r.expiresAt).toBeNull();
  });

  it('کاربر بدون هیچ ردیف اشتراکی رایگان است', () => {
    const r = resolveEffectivePlan({ active: null, queued: [], nowMs: NOW });
    expect(r.planKey).toBe('free');
    expect(r.expiresAt).toBeNull();
  });

  it('مهلت لطف، دورهٔ تازه‌منقضی را معتبر نگه می‌دارد', () => {
    const r = resolveEffectivePlan({
      active: { planKey: 'pro', expiresAt: NOW - 3 * DAY_MS },
      queued: [],
      nowMs: NOW,
      graceDays: 7,
    });
    expect(r.planKey).toBe('pro');
  });

  it('صف بر اساس زمان شروع مرتب می‌شود و اولین دورهٔ معتبر انتخاب می‌شود', () => {
    const r = resolveEffectivePlan({
      active: null,
      queued: [
        { planKey: 'pro', startsAt: NOW + 10 * DAY_MS, expiresAt: NOW + 40 * DAY_MS },
        { planKey: 'plus', startsAt: NOW - DAY_MS, expiresAt: NOW + 9 * DAY_MS },
      ],
      nowMs: NOW,
    });
    expect(r.planKey).toBe('plus');
    expect(r.stillQueued.map((q) => q.planKey)).toEqual(['pro']);
  });
});

describe('سقف و قابلیت', () => {
  it('null یعنی نامحدود و صفر یعنی بسته', () => {
    expect(isWithinLimit(null, 10_000)).toBe(true);
    expect(isWithinLimit(0, 0)).toBe(false);
    expect(isWithinLimit(5, 4)).toBe(true);
    expect(isWithinLimit(5, 5)).toBe(false);
  });

  it('قابلیت فقط با مقدار ۱ باز است', () => {
    expect(isFeatureEnabled(1)).toBe(true);
    expect(isFeatureEnabled(0)).toBe(false);
    expect(isFeatureEnabled(undefined)).toBe(false);
  });
});

describe('generateRefCode', () => {
  it('۶ کاراکتر و فقط از الفبای مجاز', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateRefCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(new RegExp(`^[${REF_CODE_ALPHABET}]{6}$`));
    }
  });

  it('هیچ‌وقت 0، O، 1، I یا L ندارد چون کاربر باید از صفحه بخواندش', () => {
    expect(REF_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 500; i += 1) {
      expect(generateRefCode()).not.toMatch(/[0O1IL]/);
    }
  });
});

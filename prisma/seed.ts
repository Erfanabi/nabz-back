/**
 * دادهٔ اولیه: کاتالوگ پلن و ادمین اول.
 *
 * منبع اعداد: BACKEND-SPEC §۵ و API-SPEC §۵.۱. هیچ‌کدام از این‌ها در کد اپ
 * hard-code نیستند — کاتالوگ از همین جدول‌ها خوانده می‌شود و ادمین می‌تواند
 * بی‌نیاز به انتشار نسخهٔ تازهٔ اپ عوضش کند.
 *
 * اجرای دوباره بی‌خطر است (idempotent).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLANS = [
  {
    key: 'free',
    title: 'رایگان',
    tier: 0,
    isPurchasable: false,
    pitch: 'هستهٔ نبض، برای شروع',
    highlights: ['ثبت نامحدود تراکنش', 'داشبورد و گزارش ماهانه', 'خروجی CSV'],
  },
  {
    key: 'plus',
    title: 'پلاس',
    tier: 1,
    isPurchasable: true,
    pitch: 'سقف‌های بازتر، گزارش و تحلیل کامل',
    highlights: ['گزارش سالانه و مقایسهٔ دوره', 'همهٔ هشدارها و بینش‌ها', 'خروجی اکسل و PDF'],
  },
  {
    // پرو تا انتشار V2 فروختنی نیست، چون قابلیت‌هایش ساخته نشده‌اند. دورهٔ آزمایشی
    // همچنان پرو می‌دهد. با انتشار V2 این پرچم true می‌شود — بدون تغییر کلاینت.
    key: 'pro',
    title: 'پرو',
    tier: 2,
    isPurchasable: false,
    pitch: 'همه‌چیز، بدون سقف، به‌علاوهٔ هوش مصنوعی',
    highlights: ['بدون هیچ سقفی', 'پیش‌بینی و تحلیل الگو', 'دستیار هوشمند و اسکن رسید'],
  },
];

/** قیمت‌ها به تومان (BACKEND-SPEC §۵.۲). */
const PRICES: Array<{ planKey: string; durationDays: number; amountToman: number }> = [
  { planKey: 'plus', durationDays: 30, amountToman: 49_000 },
  { planKey: 'plus', durationDays: 90, amountToman: 129_000 },
  { planKey: 'plus', durationDays: 365, amountToman: 449_000 },
  { planKey: 'pro', durationDays: 30, amountToman: 99_000 },
  { planKey: 'pro', durationDays: 90, amountToman: 259_000 },
  { planKey: 'pro', durationDays: 365, amountToman: 899_000 },
];

/** سقف‌ها — `null` = نامحدود، `0` = بسته (BACKEND-SPEC §۵.۳). */
const LIMITS = [
  { key: 'accounts.max', label: 'حساب و کیف پول', free: 2, plus: 5, pro: null },
  { key: 'categories.custom.max', label: 'دستهٔ اختصاصی', free: 3, plus: 15, pro: null },
  { key: 'budgets.max', label: 'بودجهٔ فعال', free: 3, plus: null, pro: null },
  { key: 'goals.max', label: 'هدف فعال', free: 1, plus: 5, pro: null },
  { key: 'recurring.max', label: 'تراکنش تکرارشونده', free: 3, plus: 15, pro: null },
  { key: 'ai.messages_per_month', label: 'پیام دستیار هوشمند', free: 0, plus: 0, pro: 150, soon: true },
  { key: 'ai.ocr_per_month', label: 'اسکن رسید', free: 0, plus: 0, pro: 30, soon: true },
];

/**
 * ماتریس قابلیت — ۲۸ کلید (BACKEND-SPEC §۵.۴).
 * `soon: true` یعنی کلید ثبت شده ولی قابلیت ساخته نشده: UI برچسب «به‌زودی»
 * می‌زند و **پنهان نمی‌کند**.
 */
const FEATURES = [
  { key: 'tx.entry', label: 'ثبت هزینه، درآمد و انتقال', free: 1, plus: 1, pro: 1 },
  { key: 'tx.quick_text', label: 'ثبت با متن کوتاه', free: 1, plus: 1, pro: 1 },
  { key: 'dashboard', label: 'داشبورد ماهانه', free: 1, plus: 1, pro: 1 },
  { key: 'reports.basic', label: 'گزارش ماهانه', free: 1, plus: 1, pro: 1 },
  { key: 'reports.yearly', label: 'گزارش سالانه', free: 0, plus: 1, pro: 1 },
  { key: 'reports.compare', label: 'مقایسهٔ دوره‌ها', free: 0, plus: 1, pro: 1 },
  { key: 'charts.basic', label: 'نمودارهای پایه', free: 1, plus: 1, pro: 1 },
  { key: 'charts.advanced', label: 'نمودارهای پیشرفته', free: 0, plus: 1, pro: 1 },
  { key: 'alerts.basic', label: 'هشدارهای پایه', free: 1, plus: 1, pro: 1 },
  { key: 'alerts.full', label: 'همهٔ هشدارها', free: 0, plus: 1, pro: 1 },
  { key: 'insights.basic', label: 'بینش‌های پایه', free: 1, plus: 1, pro: 1 },
  { key: 'insights.full', label: 'همهٔ بینش‌ها', free: 0, plus: 1, pro: 1 },
  { key: 'health_score.value', label: 'نمرهٔ سلامت مالی', free: 1, plus: 1, pro: 1 },
  { key: 'health_score.breakdown', label: 'تفکیک نمرهٔ سلامت', free: 0, plus: 1, pro: 1 },
  { key: 'export.csv', label: 'خروجی CSV', free: 1, plus: 1, pro: 1 },
  { key: 'export.pro_formats', label: 'خروجی اکسل و PDF', free: 0, plus: 1, pro: 1 },
  { key: 'debts', label: 'مدیریت قرض و بدهی', free: 0, plus: 1, pro: 1 },
  { key: 'subscription_tracker', label: 'پیگیری اشتراک‌ها', free: 0, plus: 1, pro: 1 },
  { key: 'forecasting', label: 'پیش‌بینی مالی', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'spending_patterns', label: 'تحلیل الگوی خرج', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'what_if', label: 'سناریوی «چه می‌شود اگر»', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'net_worth', label: 'ارزش خالص دارایی', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'ai.natural_entry', label: 'ثبت با زبان طبیعی', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'ai.assistant', label: 'دستیار هوشمند', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'ai.insights', label: 'بینش هوش مصنوعی', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'ai.ocr_receipt', label: 'اسکن رسید', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'family', label: 'حساب خانوادگی', free: 0, plus: 0, pro: 1, soon: true },
  { key: 'support.priority', label: 'پشتیبانی اولویت‌دار', free: 0, plus: 1, pro: 1 },
];

async function seedCatalog(): Promise<void> {
  for (const [index, plan] of PLANS.entries()) {
    const data = { ...plan, sortOrder: index };
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: data,
      update: data,
    });
  }

  for (const price of PRICES) {
    await prisma.planPrice.upsert({
      where: {
        planKey_durationDays: { planKey: price.planKey, durationDays: price.durationDays },
      },
      create: price,
      update: { amountToman: price.amountToman },
    });
  }

  for (const [index, limit] of LIMITS.entries()) {
    const data = {
      label: limit.label,
      freeValue: limit.free,
      plusValue: limit.plus,
      proValue: limit.pro,
      soon: limit.soon ?? false,
      sortOrder: index,
    };
    await prisma.planLimit.upsert({
      where: { key: limit.key },
      create: { key: limit.key, ...data },
      update: data,
    });
  }

  for (const [index, feature] of FEATURES.entries()) {
    const data = {
      label: feature.label,
      freeValue: feature.free,
      plusValue: feature.plus,
      proValue: feature.pro,
      soon: feature.soon ?? false,
      sortOrder: index,
    };
    await prisma.planFeature.upsert({
      where: { key: feature.key },
      create: { key: feature.key, ...data },
      update: data,
    });
  }

  await prisma.catalogMeta.upsert({
    where: { id: 1 },
    create: { id: 1, version: 1 },
    update: { version: { increment: 1 } },
  });
}

async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_SEED_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? '';

  if (!email || !password) {
    console.log('ℹ ادمین اول ساخته نشد: ADMIN_SEED_EMAIL و ADMIN_SEED_PASSWORD تنظیم نشده‌اند.');
    return;
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ ادمین ${email} از قبل وجود دارد؛ رمز عبور دست‌نخورده ماند.`);
    return;
  }

  await prisma.adminUser.create({
    data: { email, passwordHash: await bcrypt.hash(password, 12), name: 'ادمین' },
  });
  console.log(`✓ ادمین ${email} ساخته شد. رمز عبور را بعد از اولین ورود عوض کنید.`);
}

async function main(): Promise<void> {
  await seedCatalog();
  await seedAdmin();
  const version = (await prisma.catalogMeta.findUnique({ where: { id: 1 } }))?.version;
  console.log(
    `✓ کاتالوگ seed شد: ${PLANS.length} پلن، ${PRICES.length} قیمت، ${LIMITS.length} سقف، ${FEATURES.length} قابلیت (نسخهٔ کاتالوگ: ${version}).`,
  );
}

main()
  .catch((err) => {
    console.error('✗ seed ناموفق بود:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

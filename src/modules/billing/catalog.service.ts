import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../../common/errors';

export interface CatalogPayload {
  catalog_version: number;
  plans: Array<{
    key: string;
    title: string;
    tier: number;
    is_purchasable: boolean;
    pitch: string | null;
    highlights: string[];
  }>;
  durations: number[];
  prices: Record<string, Record<string, number>>;
  limits: Record<
    string,
    { label: string; free: number | null; plus: number | null; pro: number | null; soon?: true }
  >;
  features: Array<{
    key: string;
    label: string;
    free: number;
    plus: number;
    pro: number;
    soon?: true;
  }>;
}

/**
 * کاتالوگ پلن: قیمت، سقف و ماتریس قابلیت.
 *
 * منبع حقیقت **سرور** است (BACKEND-SPEC §۲.۳): هیچ قیمت، سقف یا قابلیتی در کد
 * اپ hard-code نیست، پس تغییر قیمت به انتشار نسخهٔ جدید اپ نیاز ندارد.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async version(): Promise<number> {
    const meta = await this.prisma.catalogMeta.findUnique({ where: { id: 1 } });
    return meta?.version ?? 1;
  }

  async build(): Promise<CatalogPayload> {
    const [meta, plans, prices, limits, features] = await Promise.all([
      this.prisma.catalogMeta.findUnique({ where: { id: 1 } }),
      this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.planPrice.findMany(),
      this.prisma.planLimit.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.planFeature.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const priceMap: Record<string, Record<string, number>> = {};
    const durations = new Set<number>();
    for (const price of prices) {
      durations.add(price.durationDays);
      priceMap[price.planKey] ??= {};
      priceMap[price.planKey][String(price.durationDays)] = price.amountToman;
    }

    const limitMap: CatalogPayload['limits'] = {};
    for (const limit of limits) {
      limitMap[limit.key] = {
        label: limit.label,
        free: limit.freeValue,
        plus: limit.plusValue,
        pro: limit.proValue,
        ...(limit.soon ? { soon: true as const } : {}),
      };
    }

    return {
      catalog_version: meta?.version ?? 1,
      plans: plans.map((p) => ({
        key: p.key,
        title: p.title,
        tier: p.tier,
        is_purchasable: p.isPurchasable,
        pitch: p.pitch,
        highlights: p.highlights,
      })),
      durations: [...durations].sort((a, b) => a - b),
      prices: priceMap,
      limits: limitMap,
      features: features.map((f) => ({
        key: f.key,
        label: f.label,
        free: f.freeValue,
        plus: f.plusValue,
        pro: f.proValue,
        ...(f.soon ? { soon: true as const } : {}),
      })),
    };
  }

  /** ETag از محتوای کاتالوگ — تا کلاینت تا تغییر واقعی، دوباره دانلود نکند. */
  etagFor(payload: CatalogPayload): string {
    return `"${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)}"`;
  }

  /** نقشهٔ tier برای موتور اشتراک. پلن ناشناس ‎-۱ می‌گیرد تا هیچ‌وقت ارتقا حساب نشود. */
  async tierMap(): Promise<(planKey: string) => number> {
    const plans = await this.prisma.plan.findMany({ select: { key: true, tier: true } });
    const map = new Map(plans.map((p) => [p.key, p.tier]));
    return (planKey: string) => map.get(planKey) ?? -1;
  }

  async requirePurchasablePlan(planKey: string, durationDays: number): Promise<number> {
    const plan = await this.prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan) {
      throw new AppError('not_found', { message: 'این پلن وجود ندارد.' });
    }
    if (!plan.isPurchasable) {
      throw new AppError('forbidden', {
        message: 'این پلن فعلاً برای خرید باز نیست.',
        messageEn: 'This plan is not purchasable yet.',
      });
    }
    const price = await this.prisma.planPrice.findUnique({
      where: { planKey_durationDays: { planKey, durationDays } },
    });
    if (!price) {
      throw new AppError('validation_failed', {
        message: 'این مدت اشتراک برای این پلن تعریف نشده.',
        fields: { duration_days: 'مدت انتخاب‌شده معتبر نیست.' },
      });
    }
    // مبلغ فقط از کاتالوگ سرور خوانده می‌شود؛ مبلغ فرستادهٔ کلاینت نادیده گرفته می‌شود.
    return price.amountToman;
  }

  /** سقف یک کلید برای یک پلن. `null` = نامحدود. */
  async limitFor(planKey: string, limitKey: string): Promise<number | null> {
    const row = await this.prisma.planLimit.findUnique({ where: { key: limitKey } });
    if (!row) return null;
    return this.pickByPlan(planKey, row.freeValue, row.plusValue, row.proValue);
  }

  async featureValue(planKey: string, featureKey: string): Promise<number> {
    const row = await this.prisma.planFeature.findUnique({ where: { key: featureKey } });
    if (!row) return 0;
    return this.pickByPlan(planKey, row.freeValue, row.plusValue, row.proValue) ?? 0;
  }

  private pickByPlan<T>(planKey: string, free: T, plus: T, pro: T): T {
    switch (planKey) {
      case 'pro':
        return pro;
      case 'plus':
        return plus;
      default:
        return free;
    }
  }

  async bumpVersion(): Promise<number> {
    const meta = await this.prisma.catalogMeta.upsert({
      where: { id: 1 },
      create: { id: 1, version: 1 },
      update: { version: { increment: 1 } },
    });
    return meta.version;
  }
}

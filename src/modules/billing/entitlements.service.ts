import { Injectable } from '@nestjs/common';
import { EntitlementSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppError } from '../../common/errors';
import { CatalogService } from './catalog.service';
import { DAY_MS, decideApproval, isWithinLimit, resolveEffectivePlan } from './domain/billing';

/** کلیدهای سقف که مصرفشان از دادهٔ کاربر شمرده می‌شود. */
const USAGE_LIMIT_KEYS = [
  'accounts.max',
  'categories.custom.max',
  'budgets.max',
  'goals.max',
  'recurring.max',
] as const;

export type UsageLimitKey = (typeof USAGE_LIMIT_KEYS)[number];

export interface EntitlementsPayload {
  effective_plan: string;
  source: EntitlementSource | null;
  expires_at: number | null;
  trial_used: boolean;
  queued: Array<{ plan_key: string; starts_at: number; expires_at: number }>;
  usage: Record<string, number>;
}

/**
 * وضعیت اشتراک کاربر.
 *
 * منبع حقیقت سرور است تا کلاینت نتواند دست‌کاری کند (BACKEND-SPEC §۲.۳).
 * مهلت لطف ۷ روزه **کار کلاینت** است، نه سرور: سرور حقیقت را می‌گوید و کلاینت
 * تصمیم می‌گیرد در آفلاین چقدر به کش قبلی اعتماد کند.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfigService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * پلن مؤثر کاربر. اگر دورهٔ صف‌شده‌ای رسیده باشد، همین‌جا ارتقا پیدا می‌کند —
   * چون هیچ cron تضمین‌شده‌ای نمی‌تواند لحظهٔ دقیق انقضا را بگیرد، و پاسخ این
   * متد باید همیشه درست باشد.
   */
  async effectivePlan(userId: string): Promise<{ planKey: string; expiresAt: number | null; source: EntitlementSource | null }> {
    const nowMs = this.clock.nowMs();

    const [active, queued] = await Promise.all([
      this.prisma.entitlement.findUnique({ where: { userId } }),
      this.prisma.queuedEntitlement.findMany({
        where: { userId, consumedAt: null },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    const resolved = resolveEffectivePlan({
      active: active
        ? { planKey: active.planKey, expiresAt: active.expiresAt?.getTime() ?? null }
        : null,
      queued: queued.map((q) => ({
        planKey: q.planKey,
        startsAt: q.startsAt.getTime(),
        expiresAt: q.expiresAt.getTime(),
      })),
      nowMs,
    });

    if (resolved.promote) {
      const promoted = queued.find(
        (q) =>
          q.planKey === resolved.promote!.planKey &&
          q.startsAt.getTime() === resolved.promote!.startsAt,
      );
      if (promoted) {
        await this.prisma.$transaction([
          this.prisma.entitlement.upsert({
            where: { userId },
            create: {
              userId,
              planKey: promoted.planKey,
              source: promoted.source,
              startsAt: promoted.startsAt,
              expiresAt: promoted.expiresAt,
            },
            update: {
              planKey: promoted.planKey,
              source: promoted.source,
              startsAt: promoted.startsAt,
              expiresAt: promoted.expiresAt,
            },
          }),
          this.prisma.queuedEntitlement.update({
            where: { id: promoted.id },
            data: { consumedAt: this.clock.now() },
          }),
        ]);
        return {
          planKey: promoted.planKey,
          expiresAt: promoted.expiresAt.getTime(),
          source: promoted.source,
        };
      }
    }

    return {
      planKey: resolved.planKey,
      expiresAt: resolved.expiresAt,
      source: resolved.planKey === 'free' ? null : (active?.source ?? null),
    };
  }

  async payload(userId: string): Promise<EntitlementsPayload> {
    const [plan, user, queued, usage] = await Promise.all([
      this.effectivePlan(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { trialUsed: true } }),
      this.prisma.queuedEntitlement.findMany({
        where: { userId, consumedAt: null },
        orderBy: { startsAt: 'asc' },
      }),
      this.usage(userId),
    ]);

    return {
      effective_plan: plan.planKey,
      source: plan.source,
      expires_at: plan.expiresAt,
      trial_used: user?.trialUsed ?? false,
      queued: queued.map((q) => ({
        plan_key: q.planKey,
        starts_at: q.startsAt.getTime(),
        expires_at: q.expiresAt.getTime(),
      })),
      usage,
    };
  }

  /**
   * مصرف فعلی هر سقف — **زنده شمرده می‌شود، ذخیره نمی‌شود** (BR-02).
   * کلاینت با این «۳ از ۵ حساب» را نشان می‌دهد.
   */
  async usage(userId: string): Promise<Record<UsageLimitKey, number>> {
    const alive = { userId, deletedAt: null };
    const [accounts, customCategories, budgets, goals, recurrings] = await Promise.all([
      this.prisma.account.count({ where: alive }),
      this.prisma.category.count({ where: { ...alive, custom: true } }),
      this.prisma.budget.count({ where: alive }),
      this.prisma.goal.count({ where: alive }),
      this.prisma.recurring.count({ where: alive }),
    ]);
    return {
      'accounts.max': accounts,
      'categories.custom.max': customCategories,
      'budgets.max': budgets,
      'goals.max': goals,
      'recurring.max': recurrings,
    };
  }

  /**
   * آیا ساختن یک مورد تازه از این نوع مجاز است؟
   * `null` = مجاز، وگرنه پیام فارسیِ سقف برای نشان دادن در شیت ارتقا.
   */
  async limitRejection(userId: string, limitKey: UsageLimitKey): Promise<string | null> {
    const plan = await this.effectivePlan(userId);
    const limit = await this.catalog.limitFor(plan.planKey, limitKey);
    if (limit === null) return null;

    const usage = await this.usage(userId);
    if (isWithinLimit(limit, usage[limitKey])) return null;

    const label = (await this.prisma.planLimit.findUnique({ where: { key: limitKey } }))?.label;
    if (limit === 0) {
      return `${label ?? 'این قابلیت'} در پلن فعلی تو باز نیست.`;
    }
    return `به سقف ${label ?? 'مجاز'} در پلن فعلی رسیدی (${limit}). برای بیشتر، پلن را ارتقا بده.`;
  }

  async requireFeature(userId: string, featureKey: string): Promise<void> {
    const plan = await this.effectivePlan(userId);
    const value = await this.catalog.featureValue(plan.planKey, featureKey);
    if (value !== 1) throw new AppError('feature_not_available');
  }

  /** شروع دورهٔ آزمایشی — یک‌بار برای هر شماره. */
  async startTrial(userId: string): Promise<EntitlementsPayload> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('not_found');
    if (user.trialUsed) throw new AppError('trial_already_used');

    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.config.trialDays * DAY_MS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { trialUsed: true } }),
      this.prisma.entitlement.upsert({
        where: { userId },
        create: { userId, planKey: 'pro', source: 'trial', startsAt: now, expiresAt },
        update: { planKey: 'pro', source: 'trial', startsAt: now, expiresAt },
      }),
    ]);

    return this.payload(userId);
  }

  /**
   * اعمال تأیید یک پرداخت.
   *
   * تصمیم «فوری یا صف‌شده» را موتور خالص `decideApproval` می‌گیرد؛ این متد فقط
   * آن را می‌نویسد. تغییر entitlement **فقط از این مسیر و فقط به‌دست ادمین**
   * ممکن است (API-SPEC §۱۰ بند ۹).
   */
  async applyPurchase(
    userId: string,
    planKey: string,
    durationDays: number,
    source: EntitlementSource = 'purchase',
  ): Promise<{ queued: boolean; startsAt: Date; endsAt: Date }> {
    const [current, tierOf] = await Promise.all([
      this.effectivePlan(userId),
      this.catalog.tierMap(),
    ]);

    const decision = decideApproval({
      planKey,
      durationDays,
      current: { planKey: current.planKey, expiresAt: current.expiresAt },
      nowMs: this.clock.nowMs(),
      tierOf,
    });

    const startsAt = new Date(decision.startsAt);
    const endsAt = new Date(decision.endsAt);

    if (decision.queued) {
      await this.prisma.queuedEntitlement.create({
        data: { userId, planKey, source, startsAt, expiresAt: endsAt },
      });
    } else {
      await this.prisma.entitlement.upsert({
        where: { userId },
        create: { userId, planKey, source, startsAt, expiresAt: endsAt },
        update: { planKey, source, startsAt, expiresAt: endsAt },
      });
    }

    return { queued: decision.queued, startsAt, endsAt };
  }
}

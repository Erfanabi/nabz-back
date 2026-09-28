import { Injectable, Logger } from '@nestjs/common';
import { PaymentRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';
import { EntitlementsService } from '../billing/entitlements.service';
import { CatalogService } from '../billing/catalog.service';
import { PaymentRequestsService } from '../billing/payment-requests.service';
import { StorageService } from '../files/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateCatalogDto } from './dto/admin.dto';
import { maskPhone } from '../../common/phone';

@Injectable()
export class AdminService {
  private readonly logger = new Logger('Admin');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly entitlements: EntitlementsService,
    private readonly catalog: CatalogService,
    private readonly requests: PaymentRequestsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * فهرست درخواست‌های پرداخت برای ادمین.
   *
   * شمارهٔ کاربر **ماسک‌شده** می‌آید: ادمین برای تصمیم گرفتن به کد پیگیری و مبلغ
   * نیاز دارد، نه به شمارهٔ کامل همهٔ کاربران در یک فهرست.
   */
  async listRequests(status: PaymentRequestStatus | undefined, limit: number, cursor?: string) {
    await this.requests.expireStale();

    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.paymentRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, phone: true, displayName: true } },
        receipts: { orderBy: { createdAt: 'desc' } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      items: page.map((row) => ({
        ...this.requests.view(row),
        user: {
          id: row.user.id,
          phone_masked: maskPhone(row.user.phone),
          display_name: row.user.displayName,
        },
        receipts: row.receipts.map((r) => ({
          id: r.id,
          channel: r.channel,
          note: r.note,
          created_at: r.createdAt.getTime(),
          // URL امضاشدهٔ کوتاه‌عمر؛ فایل در bucket عمومی نیست.
          file_url: r.filePath ? this.storage.signedUrl(r.filePath) : null,
          mime_type: r.mimeType,
          size_bytes: r.sizeBytes,
        })),
      })),
      next_cursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * تأیید واریزی.
   *
   * تصمیم «فوری یا صف‌شده» را موتور `decideApproval` می‌گیرد و نتیجه **روی خود
   * درخواست** ثبت می‌شود (`queued`, `starts_at`, `ends_at`) تا صفحهٔ وضعیت بتواند
   * فرق «الان فعال شد» و «بعد از پایان دورهٔ فعلی شروع می‌شود» را بگوید.
   */
  async approve(adminId: string, requestId: string) {
    const request = await this.prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new AppError('not_found');

    if (request.status === 'approved') {
      // تأیید دوباره اثری ندارد: دو بار افزودن دوره یعنی کاربر دو برابر گرفته.
      return this.requests.view(request);
    }
    if (request.status !== 'pending') {
      throw new AppError('forbidden', {
        message: 'این درخواست در وضعیت «در انتظار» نیست و قابل تأیید نیست.',
      });
    }

    const applied = await this.entitlements.applyPurchase(
      request.userId,
      request.planKey,
      request.durationDays,
    );

    const updated = await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        status: 'approved',
        decidedAt: this.clock.now(),
        decidedById: adminId,
        queued: applied.queued,
        startsAt: applied.startsAt,
        endsAt: applied.endsAt,
      },
    });

    // اعلان بهتر از polling است، اما مبلغ در متن نمی‌آید.
    void this.notifications.sendSystem(request.userId, {
      title: 'پرداخت تأیید شد',
      body: applied.queued
        ? 'اشتراک تازه‌ات پس از پایان دورهٔ فعلی شروع می‌شود.'
        : 'اشتراک تازه‌ات همین حالا فعال شد.',
      target: `/billing/requests/${request.id}`,
      data: { request_id: request.id, kind: 'payment_approved' },
    });

    this.logger.log(`درخواست ${updated.refCode} تأیید شد (queued=${applied.queued}).`);
    return this.requests.view(updated);
  }

  /** رد با دلیل. دلیل اجباری است چون کاربر باید بداند چرا رد شد. */
  async reject(adminId: string, requestId: string, reason: string) {
    const request = await this.prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new AppError('not_found');
    if (request.status !== 'pending') {
      throw new AppError('forbidden', {
        message: 'این درخواست در وضعیت «در انتظار» نیست و قابل رد کردن نیست.',
      });
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        status: 'rejected',
        decidedAt: this.clock.now(),
        decidedById: adminId,
        rejectReason: reason,
      },
    });

    void this.notifications.sendSystem(request.userId, {
      title: 'پرداخت تأیید نشد',
      body: 'برای دیدن دلیل و تلاش دوباره، صفحهٔ وضعیت پرداخت را باز کن.',
      target: `/billing/requests/${request.id}`,
      data: { request_id: request.id, kind: 'payment_rejected' },
    });

    return this.requests.view(updated);
  }

  /** اعطای دستی پلن — با `source: admin_grant`. */
  async grant(userId: string, planKey: string, durationDays: number, note?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('not_found');

    const plan = await this.prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan) throw new AppError('not_found', { message: 'این پلن وجود ندارد.' });

    // اعطای دستی به `is_purchasable` گره نمی‌خورد: ادمین باید بتواند پرو بدهد
    // حتی وقتی پرو برای فروش باز نیست.
    const applied = await this.entitlements.applyPurchase(
      userId,
      planKey,
      durationDays,
      'admin_grant',
    );

    this.logger.log(
      `پلن ${planKey} برای ${durationDays} روز به یک کاربر اعطا شد (queued=${applied.queued}).${
        note ? ` توضیح: ${note}` : ''
      }`,
    );

    void this.notifications.sendSystem(userId, {
      title: 'اشتراک تو فعال شد',
      body: applied.queued
        ? 'اشتراک تازه‌ات پس از پایان دورهٔ فعلی شروع می‌شود.'
        : 'اشتراک تازه‌ات همین حالا فعال شد.',
      target: '/settings/plan',
      data: { kind: 'plan_granted' },
    });

    return this.entitlements.payload(userId);
  }

  /**
   * ویرایش کاتالوگ.
   *
   * `catalog_version` بالا می‌رود تا کش کلاینت بی‌اعتبار شود. همه‌چیز در یک
   * تراکنش است: کاتالوگ نیمه‌ویرایش‌شده یعنی قیمت پلن بدون سقفش.
   */
  async updateCatalog(patch: UpdateCatalogDto) {
    await this.prisma.$transaction(async (tx) => {
      if (patch.plans) {
        for (const [index, plan] of patch.plans.entries()) {
          const data = {
            title: plan.title,
            tier: plan.tier,
            isPurchasable: plan.is_purchasable,
            pitch: plan.pitch ?? null,
            highlights: plan.highlights ?? [],
            sortOrder: index,
          };
          await tx.plan.upsert({
            where: { key: plan.key },
            create: { key: plan.key, ...data },
            update: data,
          });
        }
      }

      if (patch.prices) {
        // قیمت‌ها جای قبلی را می‌گیرند: مدتی که حذف شده نباید قابل خرید بماند.
        await tx.planPrice.deleteMany({});
        await tx.planPrice.createMany({
          data: patch.prices.map((p) => ({
            planKey: p.plan_key,
            durationDays: p.duration_days,
            amountToman: p.amount_toman,
          })),
        });
      }

      if (patch.limits) {
        for (const [index, limit] of patch.limits.entries()) {
          const data = {
            label: limit.label,
            freeValue: limit.free ?? null,
            plusValue: limit.plus ?? null,
            proValue: limit.pro ?? null,
            soon: limit.soon ?? false,
            sortOrder: index,
          };
          await tx.planLimit.upsert({
            where: { key: limit.key },
            create: { key: limit.key, ...data },
            update: data,
          });
        }
      }

      if (patch.features) {
        for (const [index, feature] of patch.features.entries()) {
          const data = {
            label: feature.label,
            freeValue: feature.free,
            plusValue: feature.plus,
            proValue: feature.pro,
            soon: feature.soon ?? false,
            sortOrder: index,
          };
          await tx.planFeature.upsert({
            where: { key: feature.key },
            create: { key: feature.key, ...data },
            update: data,
          });
        }
      }

      await tx.catalogMeta.upsert({
        where: { id: 1 },
        create: { id: 1, version: 2 },
        update: { version: { increment: 1 } },
      });
    });

    return this.catalog.build();
  }

  /** جستجوی کاربر برای پنل — با شمارهٔ کامل یا بخشی از آن. */
  async findUsers(query: string | undefined, limit: number) {
    const where: Prisma.UserWhereInput = query
      ? { phone: { contains: query.replace(/\D/g, '') } }
      : {};
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: { entitlement: true },
    });
    return users.map((u) => ({
      id: u.id,
      phone_masked: maskPhone(u.phone),
      display_name: u.displayName,
      trial_used: u.trialUsed,
      created_at: u.createdAt.getTime(),
      deletion_scheduled_at: u.deletionScheduledAt?.getTime() ?? null,
      plan: u.entitlement
        ? {
            plan_key: u.entitlement.planKey,
            source: u.entitlement.source,
            expires_at: u.entitlement.expiresAt?.getTime() ?? null,
          }
        : null,
    }));
  }
}

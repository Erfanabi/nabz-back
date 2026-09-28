import { Injectable, Logger } from '@nestjs/common';
import { PaymentRequest, PaymentRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppError } from '../../common/errors';
import { CatalogService } from './catalog.service';
import { generateRefCode } from './domain/ref-code';
import { StorageService } from '../files/storage.service';

/** حداکثر اندازهٔ تصویر رسید (API-SPEC §۵.۸). */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * الگوی احتمالی شمارهٔ کامل کارت در متن آزاد.
 * هر چیزی که به ۱۶ رقم پیوسته (با یا بدون جداکننده) شبیه باشد پیش از ذخیره
 * ماسک می‌شود: PAN کامل نباید در متن یا متادیتای رسید بنشیند (§۱۰ بند ۴).
 */
const PAN_LIKE = /(?:\d[ \-‌]?){15,18}\d/g;

export interface PaymentRequestView {
  id: string;
  plan_key: string;
  duration_days: number;
  amount_toman: number;
  ref_code: string;
  provider: string;
  status: PaymentRequestStatus;
  created_at: number;
  expires_at: number;
  reject_reason: string | null;
  decided_at: number | null;
  queued: boolean | null;
  starts_at: number | null;
  ends_at: number | null;
}

@Injectable()
export class PaymentRequestsService {
  private readonly logger = new Logger('PaymentRequests');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfigService,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
  ) {}

  view(request: PaymentRequest): PaymentRequestView {
    return {
      id: request.id,
      plan_key: request.planKey,
      duration_days: request.durationDays,
      amount_toman: request.amountToman,
      ref_code: request.refCode,
      provider: request.provider,
      status: request.status,
      created_at: request.createdAt.getTime(),
      expires_at: request.expiresAt.getTime(),
      reject_reason: request.rejectReason,
      decided_at: request.decidedAt?.getTime() ?? null,
      queued: request.queued,
      starts_at: request.startsAt?.getTime() ?? null,
      ends_at: request.endsAt?.getTime() ?? null,
    };
  }

  /**
   * ساخت درخواست پرداخت.
   *
   * اگر درخواست `pending` با **همان پلن و همان مدت** وجود دارد، درخواست تازه
   * ساخته نمی‌شود و همان قبلی برمی‌گردد: دو کد پیگیری برای یک واریز یعنی ادمین
   * نمی‌داند کدام را تأیید کند (API-SPEC §۵.۵ بند ۱).
   */
  async create(
    userId: string,
    planKey: string,
    durationDays: number,
    provider: string,
  ): Promise<{ request: PaymentRequestView; created: boolean }> {
    const amountToman = await this.catalog.requirePurchasablePlan(planKey, durationDays);
    const now = this.clock.now();

    await this.expireStale(userId);

    const existing = await this.prisma.paymentRequest.findFirst({
      where: {
        userId,
        planKey,
        durationDays,
        status: 'pending',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { request: this.view(existing), created: false };

    const expiresAt = new Date(now.getTime() + this.config.requestTtlHours * 3_600_000);

    // برخورد کد پیگیری در فضای ۳۱^۶ نادر است، اما کد یکتاست پس چند بار تلاش می‌شود.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const created = await this.prisma.paymentRequest.create({
          data: {
            userId,
            planKey,
            durationDays,
            amountToman,
            refCode: generateRefCode(),
            provider,
            status: 'pending',
            expiresAt,
          },
        });
        return { request: this.view(created), created: true };
      } catch (err) {
        if (attempt === 5) throw err;
      }
    }
    throw new AppError('server_error');
  }

  async list(
    userId: string,
    status: PaymentRequestStatus | undefined,
    limit: number,
    cursor: string | undefined,
  ): Promise<{ items: PaymentRequestView[]; next_cursor: string | null }> {
    await this.expireStale(userId);

    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.paymentRequest.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, take) : rows).map((r) => this.view(r));
    return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
  }

  async get(userId: string, id: string): Promise<PaymentRequestView> {
    const request = await this.findOwned(userId, id);
    // انقضا در لحظهٔ خواندن هم اعمال می‌شود تا صفحهٔ وضعیت هیچ‌وقت «در انتظار»
    // نشان ندهد وقتی مهلت تمام شده.
    if (request.status === 'pending' && request.expiresAt <= this.clock.now()) {
      const expired = await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: { status: 'expired' },
      });
      return this.view(expired);
    }
    return this.view(request);
  }

  /** اعلام ارسال رسید. فایل اختیاری است. */
  async submitReceipt(
    userId: string,
    id: string,
    channel: string,
    note: string | undefined,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
  ): Promise<PaymentRequestView> {
    const request = await this.findOwned(userId, id);
    if (request.status !== 'pending') {
      throw new AppError('forbidden', {
        message: 'این درخواست دیگر در انتظار تأیید نیست.',
      });
    }
    if (request.expiresAt <= this.clock.now()) {
      await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: { status: 'expired' },
      });
      throw new AppError('payment_request_expired');
    }

    let stored: { path: string; mimeType: string; sizeBytes: number } | null = null;
    if (file) {
      this.validateReceiptFile(file);
      stored = await this.storage.save(
        `receipts/${userId}`,
        file.originalname,
        file.mimetype,
        file.buffer,
      );
    }

    await this.prisma.paymentReceipt.create({
      data: {
        requestId: request.id,
        channel,
        note: note ? this.redactPan(note) : null,
        filePath: stored?.path ?? null,
        mimeType: stored?.mimeType ?? null,
        sizeBytes: stored?.sizeBytes ?? null,
      },
    });

    return this.view(request);
  }

  private validateReceiptFile(file: { mimetype: string; size: number }): void {
    if (!RECEIPT_MIME_TYPES.includes(file.mimetype)) {
      throw new AppError('validation_failed', {
        message: 'فقط تصویر (JPEG، PNG، WebP) یا PDF قابل ارسال است.',
        fields: { file: 'قالب فایل پذیرفته نمی‌شود.' },
      });
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      throw new AppError('payload_too_large', {
        message: 'حجم فایل رسید باید کمتر از ۵ مگابایت باشد.',
      });
    }
  }

  /** شمارهٔ کارتِ کامل را در متن رسید ماسک می‌کند؛ فقط چهار رقم آخر می‌ماند. */
  private redactPan(text: string): string {
    return text.replace(PAN_LIKE, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 12) return match;
      return `••••${digits.slice(-4)}`;
    });
  }

  /** لغو توسط کاربر. فقط روی pending اثر دارد؛ روی بقیه no-op با ۲۰۰. */
  async cancel(userId: string, id: string): Promise<PaymentRequestView> {
    const request = await this.findOwned(userId, id);
    if (request.status !== 'pending') return this.view(request);
    const cancelled = await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: { status: 'cancelled', decidedAt: this.clock.now() },
    });
    return this.view(cancelled);
  }

  /** مجوزدهی بر مبنای مالکیت — ID از URL هیچ‌وقت بدون بررسی مالک قبول نمی‌شود. */
  private async findOwned(userId: string, id: string): Promise<PaymentRequest> {
    const request = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!request || request.userId !== userId) throw new AppError('not_found');
    return request;
  }

  /** درخواست‌های از مهلت گذشته را `expired` می‌کند. */
  async expireStale(userId?: string): Promise<number> {
    const { count } = await this.prisma.paymentRequest.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lte: this.clock.now() },
        ...(userId ? { userId } : {}),
      },
      data: { status: 'expired' },
    });
    if (count > 0 && !userId) {
      this.logger.log(`${count} درخواست پرداخت از مهلت گذشته منقضی شد.`);
    }
    return count;
  }
}

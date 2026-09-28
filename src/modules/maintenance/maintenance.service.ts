import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { OtpService } from '../auth/otp.service';
import { UsersService } from '../users/users.service';
import { PaymentRequestsService } from '../billing/payment-requests.service';

/**
 * کارهای دوره‌ای.
 *
 * هر کار با یک **قفل در دیتابیس** اجرا می‌شود تا در استقرار چنداینستنسی دو بار
 * اجرا نشود — بدون Redis، با همان `INSERT … ON CONFLICT` که rate limit استفاده می‌کند.
 * هیچ‌کدام از این کارها در مسیر درخواست کاربر نیستند.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger('Maintenance');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly rateLimit: RateLimitService,
    private readonly otp: OtpService,
    private readonly users: UsersService,
    private readonly payments: PaymentRequestsService,
  ) {}

  /** قفل با انقضا: اگر اینستنسی وسط کار بمیرد، قفل خودش آزاد می‌شود. */
  private async withLock(
    name: string,
    ttlSeconds: number,
    task: () => Promise<void>,
  ): Promise<void> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const acquired = await this.prisma.$executeRaw`
      INSERT INTO job_locks (name, locked_at, expires_at)
      VALUES (${name}, ${now}, ${expiresAt})
      ON CONFLICT (name) DO UPDATE
        SET locked_at = ${now}, expires_at = ${expiresAt}
        WHERE job_locks.expires_at < ${now}
    `;
    if (acquired === 0) return;

    try {
      await task();
    } catch (err) {
      this.logger.error(`اجرای کار «${name}» ناموفق بود.`, err as Error);
    } finally {
      await this.prisma.jobLock.deleteMany({ where: { name } });
    }
  }

  /** درخواست‌های پرداخت از مهلت گذشته. */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePaymentRequests(): Promise<void> {
    await this.withLock('expire_payment_requests', 300, async () => {
      await this.payments.expireStale();
    });
  }

  /** حذف کامل حساب‌هایی که مهلت ۷ روزه‌شان تمام شده. */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeDeletedAccounts(): Promise<void> {
    await this.withLock('purge_deleted_accounts', 900, async () => {
      await this.users.purgeDueDeletions();
    });
  }

  /** پاک کردن ردیف‌های زیرساختیِ کهنه. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeEphemeral(): Promise<void> {
    await this.withLock('purge_ephemeral', 900, async () => {
      const rateLimits = await this.rateLimit.purgeExpired();
      const otps = await this.otp.purgeExpired();

      // کلیدهای idempotency بیش از یک هفته لازم نیستند: صف کلاینت خیلی زودتر خالی می‌شود.
      const { count: keys } = await this.prisma.idempotencyKey.deleteMany({
        where: { createdAt: { lt: this.clock.plusDays(-7) } },
      });
      // توکن‌های منقضی هم بعد از ۳۰ روز نگه داشتن دلیلی ندارند.
      const { count: tokens } = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: this.clock.plusDays(-30) } },
      });

      this.logger.log(
        `پاک‌سازی روزانه: ${rateLimits} شمارندهٔ نرخ، ${otps} چالش OTP، ${keys} کلید idempotency، ${tokens} توکن.`,
      );
    });
  }
}

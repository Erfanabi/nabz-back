import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppError } from '../../common/errors';
import { StorageService } from '../files/storage.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger('Users');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('not_found');
    return {
      id: user.id,
      phone: user.phone,
      display_name: user.displayName,
      created_at: user.createdAt.toISOString(),
      deletion_scheduled_at: user.deletionScheduledAt?.toISOString() ?? null,
    };
  }

  /**
   * فقط فیلدهای فرستاده‌شده تغییر می‌کنند (فیلد غایب = تغییر نکرده).
   * تغییر شماره موبایل از این مسیر ممنوع است؛ اگر لازم شد، جریان OTP جداگانه.
   */
  async updateMe(userId: string, patch: { display_name?: string | null }) {
    const data: { displayName?: string | null } = {};
    if ('display_name' in patch) {
      const value = patch.display_name;
      data.displayName = value === null || value === undefined || value === '' ? null : value.trim();
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    return this.me(userId);
  }

  /**
   * حذف حساب با مهلت ۷ روزه برای پشیمانی.
   *
   * ورود موفق بعدی، حذف را لغو می‌کند (در `AuthService`). بعد از مهلت، حذف
   * **کامل و برگشت‌ناپذیر** است (API-SPEC §۱۰ بند ۱۲).
   */
  async scheduleDeletion(userId: string) {
    const scheduledAt = this.clock.plusDays(this.config.accountDeletionGraceDays);
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: scheduledAt },
    });
    return {
      deletion_scheduled_at: scheduledAt.toISOString(),
      grace_days: this.config.accountDeletionGraceDays,
    };
  }

  /**
   * اجرای حذف‌های سررسیدشده.
   *
   * فایل‌های رسید هم پاک می‌شوند: حذف حساب که فایل حساس روی دیسک باقی بگذارد،
   * حذف نیست.
   */
  async purgeDueDeletions(): Promise<number> {
    const due = await this.prisma.user.findMany({
      where: { deletionScheduledAt: { lte: this.clock.now() } },
      select: { id: true },
    });

    for (const user of due) {
      const receipts = await this.prisma.paymentReceipt.findMany({
        where: { request: { userId: user.id }, filePath: { not: null } },
        select: { filePath: true },
      });
      for (const receipt of receipts) {
        if (receipt.filePath) await this.storage.remove(receipt.filePath);
      }
      // بقیهٔ جدول‌ها با onDelete: Cascade پاک می‌شوند.
      await this.prisma.user.delete({ where: { id: user.id } });
    }

    if (due.length > 0) {
      this.logger.log(`${due.length} حساب پس از پایان مهلت، کامل حذف شد.`);
    }
    return due.length;
  }
}

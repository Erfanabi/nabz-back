import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { ClockService } from '../clock.service';
import { AppError } from '../errors';

export interface RateLimitRule {
  /** نام سطل — در کلید نهایی می‌آید تا سطل‌های مختلف قاطی نشوند. */
  name: string;
  limit: number;
  windowSeconds: number;
}

/**
 * محدودیت نرخ روی Postgres (بدون Redis).
 *
 * الگو: پنجرهٔ ثابت با یک UPSERT اتمیک. شمارش در همان تراکنش افزایش می‌یابد، پس
 * چند اینستنس API هم نتیجهٔ درست می‌دهند. سقف‌ها در API-SPEC §۲.۵ آمده و
 * محدودیت باید هم روی شماره و هم روی IP اعمال شود (§۱۰ بند ۶).
 */
@Injectable()
export class RateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /**
   * یک واحد از سطل مصرف می‌کند. اگر سقف پر بود `rate_limited` می‌اندازد با
   * `retry_after` برابر ثانیه‌های باقی‌ماندهٔ پنجره.
   */
  async consume(rule: RateLimitRule, identifier: string): Promise<void> {
    const remaining = await this.peekConsume(rule, identifier);
    if (remaining !== null) {
      throw new AppError('rate_limited', { retryAfter: remaining });
    }
  }

  /** مثل consume ولی به‌جای خطا، ثانیه‌های انتظار را برمی‌گرداند (null = مجاز). */
  async peekConsume(rule: RateLimitRule, identifier: string): Promise<number | null> {
    const now = this.clock.now();
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const expiresAt = new Date(windowStart.getTime() + windowMs);
    const bucket = `${rule.name}:${identifier}:${windowStart.getTime()}`;

    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_counters (bucket, window_start, count, expires_at)
      VALUES (${bucket}, ${windowStart}, 1, ${expiresAt})
      ON CONFLICT (bucket) DO UPDATE SET count = rate_limit_counters.count + 1
      RETURNING count
    `;

    const count = Number(rows[0]?.count ?? 1);
    if (count > rule.limit) {
      return Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
    }
    return null;
  }

  /** پاک کردن ردیف‌های منقضی — با یک cron روزانه صدا زده می‌شود. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.rateLimitCounter.deleteMany({
      where: { expiresAt: { lt: this.clock.now() } },
    });
    return count;
  }
}

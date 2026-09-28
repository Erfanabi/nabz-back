import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { isQuietNow } from './quiet-hours';

/** هفت نوع هشدار (FR-ALR-01…07). کلید همان کلید `settings.alerts` است. */
export type AlertKind =
  | 'budgetNear'
  | 'budgetOver'
  | 'spendingSpike'
  | 'recurringDue'
  | 'balanceDrop'
  | 'goalBehind'
  | 'savingRateDown';

/** پیام‌های تصمیم پرداخت — همیشه فرستاده می‌شوند و مشمول ساعت آرام نیستند نیز نیستند. */
export type SystemKind = 'paymentDecision';

export interface PushMessage {
  title: string;
  body: string;
  /** مسیر مقصد در اپ. */
  target?: string;
  /** داده‌های همراه — هیچ‌وقت مبلغ. */
  data?: Record<string, string>;
}

/**
 * ارسال اعلان با Expo Push.
 *
 * سه قاعدهٔ سند (API-SPEC §۸.۳) در همین کلاس اجبار می‌شوند:
 *  ۱. هشدار فقط اگر کلیدش در `settings.alerts` روشن است فرستاده می‌شود.
 *  ۲. **ساعت آرام** به وقت محلی کاربر محترم شمرده می‌شود.
 *  ۳. **مبلغ در متن notification نمی‌آید** — متن روی صفحهٔ قفل گوشی دیده می‌شود.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Push');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * الگوی عددِ پول در متن اعلان.
   * مبلغ نباید در متن بیاید، پس هر دنبالهٔ عددیِ چهار رقم و بیشتر (با جداکنندهٔ
   * هزارگان فارسی یا لاتین) پیش از ارسال حذف می‌شود — یک تور ایمنی، تا یک
   * پیام‌سازِ آیندهٔ بی‌دقت این قاعده را نشکند.
   */
  private static readonly MONEY_LIKE = /[\d۰-۹][\d۰-۹,،٬]{3,}/g;

  private stripAmounts(text: string): string {
    return text.replace(NotificationsService.MONEY_LIKE, '').replace(/\s{2,}/g, ' ').trim();
  }

  /** ارسال هشدار مالی. اگر کلید خاموش یا ساعت آرام باشد، بی‌صدا رد می‌شود. */
  async sendAlert(userId: string, kind: AlertKind, message: PushMessage): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) return false;

    const alerts = (settings.alerts as Record<string, boolean>) ?? {};
    if (alerts[kind] !== true) return false;

    if (
      isQuietNow(this.clock.now(), {
        quietHours: settings.quietHours,
        quietFrom: settings.quietFrom,
        quietTo: settings.quietTo,
        timezone: settings.timezone,
      })
    ) {
      return false;
    }

    return this.send(userId, message);
  }

  /**
   * اعلان سیستمی (تصمیم ادمین روی پرداخت).
   *
   * مشمول `settings.alerts` نیست چون هشدار مالی نیست و کاربر منتظر همین است؛
   * ساعت آرام اما محترم شمرده می‌شود.
   */
  async sendSystem(userId: string, message: PushMessage): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (
      settings &&
      isQuietNow(this.clock.now(), {
        quietHours: settings.quietHours,
        quietFrom: settings.quietFrom,
        quietTo: settings.quietTo,
        timezone: settings.timezone,
      })
    ) {
      return false;
    }
    return this.send(userId, message);
  }

  private async send(userId: string, message: PushMessage): Promise<boolean> {
    if (!this.config.pushEnabled) return false;

    const tokens = await this.prisma.devicePushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return false;

    const payload = tokens.map((t) => ({
      to: t.token,
      title: this.stripAmounts(message.title),
      body: this.stripAmounts(message.body),
      sound: 'default',
      data: { ...(message.data ?? {}), ...(message.target ? { target: message.target } : {}) },
    }));

    try {
      const res = await fetch(this.config.expoPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.config.expoAccessToken
            ? { Authorization: `Bearer ${this.config.expoAccessToken}` }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`ارسال اعلان ناموفق بود (HTTP ${res.status}).`);
        return false;
      }
      await this.pruneInvalidTokens(res);
      return true;
    } catch {
      // ناکامی در ارسال اعلان هیچ‌وقت نباید عملیات اصلی را بشکند.
      this.logger.warn('ارسال اعلان به‌خاطر خطای شبکه انجام نشد.');
      return false;
    }
  }

  /** توکن‌هایی که Expo نامعتبر اعلام کرده حذف می‌شوند تا صف ارسال آلوده نماند. */
  private async pruneInvalidTokens(res: Response): Promise<void> {
    try {
      const body = (await res.json()) as {
        data?: Array<{ status: string; details?: { error?: string; expoPushToken?: string } }>;
      };
      const dead = (body.data ?? [])
        .filter((item) => item.details?.error === 'DeviceNotRegistered')
        .map((item) => item.details?.expoPushToken)
        .filter((t): t is string => typeof t === 'string');
      if (dead.length > 0) {
        await this.prisma.devicePushToken.deleteMany({ where: { token: { in: dead } } });
      }
    } catch {
      // پاسخ غیرقابل تفسیر — چیزی حذف نمی‌شود.
    }
  }

  async registerToken(
    userId: string,
    deviceId: string,
    platform: string,
    token: string,
    appVersion: string | undefined,
  ): Promise<{ registered: true }> {
    await this.prisma.devicePushToken.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, platform, token, appVersion: appVersion ?? null },
      update: { platform, token, appVersion: appVersion ?? null },
    });
    return { registered: true };
  }
}

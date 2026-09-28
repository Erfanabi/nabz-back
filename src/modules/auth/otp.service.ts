import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';
import { maskPhone } from '../../common/phone';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.rules';

export interface OtpRequestResult {
  sent: true;
  otp_length: number;
  expires_in: number;
  resend_after: number;
  attempts_allowed: number;
}

/**
 * چالش OTP.
 *
 * دو الزام امنیتی که شکل این کلاس را تعیین کرده‌اند:
 *  ۱. **enumeration resistance** — پاسخ `request` برای شمارهٔ موجود و جدید یکسان
 *     است: نه فیلد متفاوت، نه کد وضعیت متفاوت، نه زمان پاسخ متفاوت. پس کاربر
 *     در این مرحله **ساخته نمی‌شود** و مسیر برای هر دو حالت یکی است.
 *  ۲. کد **هش‌شده** ذخیره می‌شود و مقایسه **زمان‌ثابت** است (API-SPEC §۱۰ بند ۲).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger('Otp');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly clock: ClockService,
    private readonly rateLimit: RateLimitService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /**
   * هش کد. از sha256 با نمک ثابتِ سرور استفاده می‌شود و نه bcrypt: کد فقط ۱۲۰
   * ثانیه عمر دارد و مسیر verify باید سریع و **با زمان ثابت** باشد؛ bcrypt زمان
   * اجرای متغیر دارد و به همان کانال جانبی‌ای که می‌خواهیم ببندیم باز می‌کند.
   * فضای کلید کوچک است، پس نمکِ مخفی سرور همان چیزی است که brute-force آفلاین
   * روی دیتابیس دزدیده‌شده را بی‌فایده می‌کند.
   */
  private hashCode(phone: string, code: string): string {
    return createHash('sha256')
      .update(`${this.config.accessSecret}|${phone}|${code}`)
      .digest('hex');
  }

  private generateCode(): string {
    const digits = this.config.otpLength;
    let code = '';
    for (let i = 0; i < digits; i += 1) code += String(randomInt(10));
    return code;
  }

  private constantTimeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * درخواست کد.
   *
   * پاسخ همیشه یکسان است. اگر چالش فعالی هست که هنوز به مهلت ارسال دوباره
   * نرسیده، کد تازه ساخته **نمی‌شود** و همان پاسخ برمی‌گردد — بدون اینکه کاربر
   * از وجود چالش قبلی چیزی بفهمد.
   */
  async request(phone: string, deviceId: string | undefined, ip: string): Promise<OtpRequestResult> {
    const startedAt = Date.now();

    await this.rateLimit.consume(RATE_LIMITS.otpRequestIp, `ip:${ip}`);
    await this.rateLimit.consume(RATE_LIMITS.otpRequestPhone, `phone:${phone}`);

    const now = this.clock.now();
    const recent = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    const resendAllowedAt = recent
      ? new Date(recent.createdAt.getTime() + this.config.otpResendAfterSeconds * 1000)
      : null;

    if (!recent || (resendAllowedAt !== null && resendAllowedAt <= now)) {
      const code = this.generateCode();
      await this.prisma.otpChallenge.create({
        data: {
          phone,
          codeHash: this.hashCode(phone, code),
          expiresAt: this.clock.plusSeconds(this.config.otpTtlSeconds),
          deviceId: deviceId ?? null,
        },
      });
      try {
        await this.sms.sendOtp(phone, code);
      } catch {
        // خطای فرستندهٔ پیامک به کاربر نمی‌رسد و شکل پاسخ را عوض نمی‌کند.
        this.logger.error(`ارسال کد به ${maskPhone(phone)} ناموفق بود.`);
      }
    }

    await this.padResponseTime(startedAt);

    return {
      sent: true,
      otp_length: this.config.otpLength,
      expires_in: this.config.otpTtlSeconds,
      resend_after: this.config.otpResendAfterSeconds,
      attempts_allowed: this.config.otpMaxAttempts,
    };
  }

  /**
   * زمان پاسخ را به یک کف ثابت می‌رساند.
   *
   * بدون این، مسیر «شمارهٔ تازه» (که کد می‌سازد و پیامک می‌فرستد) از مسیر
   * «شمارهٔ در مهلت ارسال دوباره» کندتر است و همان اختلاف، enumeration می‌سازد.
   */
  private async padResponseTime(startedAt: number): Promise<void> {
    const elapsed = Date.now() - startedAt;
    const remaining = this.config.otpRequestMinMs - elapsed;
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  /**
   * بررسی کد. در صورت درستی، چالش مصرف می‌شود.
   *
   * خطاها هیچ‌وقت نمی‌گویند شماره ثبت بود یا نه — تنها چیزی که گفته می‌شود
   * «کد درست نبود» است (BACKEND-SPEC §۳.۲).
   */
  async verify(phone: string, code: string): Promise<void> {
    const now = this.clock.now();

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) throw new AppError('otp_invalid');

    if (challenge.lockedUntil && challenge.lockedUntil > now) {
      throw new AppError('otp_locked', {
        retryAfter: Math.ceil((challenge.lockedUntil.getTime() - now.getTime()) / 1000),
      });
    }

    if (challenge.expiresAt <= now) throw new AppError('otp_expired');

    const matches = this.constantTimeEquals(challenge.codeHash, this.hashCode(phone, code));

    if (!matches) {
      const attempts = challenge.attempts + 1;
      const reachedLimit = attempts >= this.config.otpMaxAttempts;
      const lockedUntil = reachedLimit
        ? this.clock.plusSeconds(this.config.otpLockMinutes * 60)
        : null;

      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts, lockedUntil },
      });

      if (reachedLimit) {
        throw new AppError('otp_locked', { retryAfter: this.config.otpLockMinutes * 60 });
      }
      throw new AppError('otp_invalid');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });
  }

  /** پاک کردن چالش‌های کهنه — با cron روزانه. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.otpChallenge.deleteMany({
      where: { expiresAt: { lt: this.clock.plusSeconds(-86_400) } },
    });
    return count;
  }
}

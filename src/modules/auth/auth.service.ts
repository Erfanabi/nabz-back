import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';
import { normalizePhone } from '../../common/phone';
import { EntitlementsService } from '../billing/entitlements.service';

export interface VerifyResult {
  access_token: string;
  access_expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  user: { id: string; phone: string; created_at: string; is_new: boolean };
  entitlements: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly clock: ClockService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** شماره را نرمال می‌کند یا `phone_invalid` می‌اندازد. */
  private requirePhone(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) {
      throw new AppError('phone_invalid', {
        fields: { phone: 'یک شماره موبایل ایران وارد کن (مثل ۰۹۱۲۱۲۳۴۵۶۷).' },
      });
    }
    return phone;
  }

  async requestOtp(rawPhone: string, deviceId: string | undefined, ip: string) {
    const phone = this.requirePhone(rawPhone);
    return this.otp.request(phone, deviceId, ip);
  }

  /**
   * تأیید کد و ورود.
   *
   * کاربر **اینجا** ساخته می‌شود، نه در مرحلهٔ درخواست کد: `is_new` بعد از تأیید
   * موفق می‌آید، پس enumeration نمی‌سازد (API-SPEC §۳.۲).
   */
  async verifyOtp(
    rawPhone: string,
    code: string,
    deviceId: string | undefined,
    deviceName: string | undefined,
    platform: string | undefined,
    city: string | undefined,
  ): Promise<VerifyResult> {
    const phone = this.requirePhone(rawPhone);
    await this.otp.verify(phone, code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const isNew = existing === null;

    const user =
      existing ??
      (await this.prisma.user.create({
        data: { phone, settings: { create: {} } },
      }));

    // ورود موفق، ارادهٔ روشن کاربر برای ادامهٔ استفاده است: حذف زمان‌بندی‌شده لغو می‌شود.
    if (user.deletionScheduledAt !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { deletionScheduledAt: null },
      });
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: deviceId ?? 'unknown',
        deviceName: deviceName ?? null,
        platform: platform ?? null,
        city: city ?? null,
        lastActiveAt: this.clock.now(),
      },
    });

    const pair = await this.tokens.issuePair(user.id, session.id);

    // entitlements همین‌جا برمی‌گردد تا اپ یک round-trip کمتر بزند و بلافاصله
    // آفلاین‌پذیر شود (API-SPEC §۳.۲).
    const entitlements = await this.entitlements.payload(user.id);

    return {
      access_token: pair.accessToken,
      access_expires_in: pair.accessExpiresIn,
      refresh_token: pair.refreshToken,
      refresh_expires_in: pair.refreshExpiresIn,
      user: {
        id: user.id,
        phone: user.phone,
        created_at: user.createdAt.toISOString(),
        is_new: isNew,
      },
      entitlements,
    };
  }

  async refresh(refreshToken: string) {
    const rotated = await this.tokens.rotate(refreshToken);
    return {
      access_token: rotated.accessToken,
      access_expires_in: rotated.accessExpiresIn,
      refresh_token: rotated.refreshToken,
      refresh_expires_in: rotated.refreshExpiresIn,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.tokens.revokeByRefreshToken(refreshToken, userId);
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      device_name: s.id === currentSessionId ? 'همین دستگاه' : (s.deviceName ?? 'دستگاه ناشناس'),
      platform: s.platform,
      city: s.city,
      last_active_at: s.lastActiveAt.toISOString(),
      created_at: s.createdAt.toISOString(),
      is_current: s.id === currentSessionId,
    }));
  }

  /** قطع یک جلسه. مالکیت بررسی می‌شود — ID از مسیر هیچ‌وقت بدون بررسی مالک قبول نمی‌شود. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new AppError('not_found');
    if (session.revokedAt !== null) return;
    await this.tokens.revokeSession(sessionId);
  }
}

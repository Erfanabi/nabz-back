import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface TokenPair {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}

/**
 * صدور و چرخش توکن.
 *
 * refresh token **مقدار تصادفی مات** است، نه JWT، و در دیتابیس فقط **هش** آن
 * می‌نشیند — تا سرقت دیتابیس به سرقت جلسه تبدیل نشود.
 * هر refresh توکن قبلی را مصرف‌شده می‌کند؛ استفادهٔ دوبارهٔ توکن مصرف‌شده نشانهٔ
 * سرقت است و **همهٔ جلسه‌های آن کاربر** را می‌بندد (API-SPEC §۳.۳).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly clock: ClockService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issuePair(userId: string, sessionId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId } satisfies AccessTokenPayload,
      { secret: this.config.accessSecret, expiresIn: this.config.accessTtlSeconds },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        sessionId,
        tokenHash: this.hash(refreshToken),
        expiresAt: this.clock.plusSeconds(this.config.refreshTtlSeconds),
      },
    });

    return {
      accessToken,
      accessExpiresIn: this.config.accessTtlSeconds,
      refreshToken,
      refreshExpiresIn: this.config.refreshTtlSeconds,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.accessSecret,
      });
    } catch (err) {
      const expired = err instanceof Error && err.name === 'TokenExpiredError';
      throw new AppError(expired ? 'token_expired' : 'unauthorized');
    }
  }

  /**
   * چرخش refresh token.
   *
   * ترتیب بررسی‌ها مهم است: اول تشخیص استفادهٔ دوباره (سرقت)، بعد انقضا. اگر
   * ترتیب برعکس بود، مهاجم با یک توکن دزدیدهٔ منقضی، آلارم سرقت را دور می‌زد.
   */
  async rotate(rawToken: string): Promise<TokenPair & { userId: string; sessionId: string }> {
    const tokenHash = this.hash(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });

    if (!record) throw new AppError('token_revoked');

    if (record.usedAt !== null || record.revokedAt !== null) {
      // توکن مصرف‌شده دوباره آمد → احتمال سرقت. همهٔ جلسه‌های کاربر بسته می‌شود.
      await this.revokeAllSessions(record.session.userId);
      throw new AppError('token_revoked');
    }

    if (record.session.revokedAt !== null) throw new AppError('token_revoked');
    if (record.expiresAt <= this.clock.now()) throw new AppError('token_expired');

    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      this.prisma.session.update({
        where: { id: record.sessionId },
        data: { lastActiveAt: now },
      }),
    ]);

    const pair = await this.issuePair(record.session.userId, record.sessionId);
    return { ...pair, userId: record.session.userId, sessionId: record.sessionId };
  }

  /** خروج: فقط همین جلسه. */
  async revokeByRefreshToken(rawToken: string, userId: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
      include: { session: true },
    });
    // خروجِ توکن ناشناس یا مال کاربر دیگر بی‌صدا موفق است: خروج هیچ‌وقت نباید خطا بدهد.
    if (!record || record.session.userId !== userId) return;
    await this.revokeSession(record.sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }
}

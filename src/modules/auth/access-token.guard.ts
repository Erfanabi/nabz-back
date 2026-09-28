import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../../common/errors';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from './public.decorator';
import { ClockService } from '../../common/clock.service';

/**
 * گارد سراسری توکن دسترسی.
 *
 * علاوه بر امضای JWT، **باطل نبودن جلسه** هم بررسی می‌شود: قطع جلسهٔ یک دستگاه
 * باید فوراً اثر کند (چک‌لیست §۱۱)، و بدون این بررسی، توکن دسترسیِ صادرشده تا
 * پایان عمرش کار می‌کرد.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  /** هر چند ثانیه یک‌بار `last_active_at` نوشته شود — تا هر درخواست یک UPDATE نزند. */
  private static readonly ACTIVITY_WRITE_INTERVAL_MS = 60_000;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly clock: ClockService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.extractToken(req);

    if (!token) {
      if (optional) return true;
      throw new AppError('unauthorized');
    }

    let payload: { sub: string; sid: string };
    try {
      payload = await this.tokens.verifyAccessToken(token);
    } catch (err) {
      if (optional) return true;
      throw err;
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt !== null || session.userId !== payload.sub) {
      if (optional) return true;
      throw new AppError('token_revoked');
    }

    req.user = { userId: payload.sub, sessionId: payload.sid };
    void this.touchSession(session.id, session.lastActiveAt);
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (!value || scheme.toLowerCase() !== 'bearer') return null;
    return value.trim() || null;
  }

  private async touchSession(sessionId: string, lastActiveAt: Date): Promise<void> {
    const now = this.clock.now();
    if (now.getTime() - lastActiveAt.getTime() < AccessTokenGuard.ACTIVITY_WRITE_INTERVAL_MS) {
      return;
    }
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: now },
      });
    } catch {
      // به‌روزرسانی آخرین فعالیت هیچ‌وقت نباید درخواست کاربر را بشکند.
    }
  }
}

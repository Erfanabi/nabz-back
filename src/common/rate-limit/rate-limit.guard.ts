import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RateLimitService } from './rate-limit.service';
import { RATE_LIMITS } from './rate-limit.rules';
import { RATE_LIMIT_KEY, RateLimitMeta } from './rate-limit.decorator';
import { clientIp } from '../client-ip';

/**
 * گارد عمومی محدودیت نرخ.
 *
 * پیش‌فرض: سقف «بقیه» روی شناسهٔ کاربر (یا IP اگر ناشناس). مسیرهایی که سقف
 * خاص دارند با `@RateLimit()` علامت می‌خورند. مسیرهای OTP خودشان جداگانه هم روی
 * شماره محدود می‌شوند، چون شماره در بدنه است و گارد به آن تکیه نمی‌کند.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();

    const meta = this.reflector.getAllAndOverride<RateLimitMeta | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (meta === null) return true; // @RateLimit(null) = معاف

    const rule = meta?.rule ?? RATE_LIMITS.general;
    const identifier = req.user?.userId ?? `ip:${clientIp(req)}`;
    await this.rateLimit.consume(rule, identifier);
    return true;
  }
}

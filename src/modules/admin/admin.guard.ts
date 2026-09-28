import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AppError } from '../../common/errors';
import { ADMIN_PUBLIC_KEY } from './admin-public.decorator';

/**
 * گارد مسیرهای ادمین.
 *
 * روی کنترلر ادمین گذاشته می‌شود و **جایگزین** گارد توکن کاربر است: توکن کاربر
 * هرگز نباید مسیر ادمین را باز کند (API-SPEC §۱۰ بند ۹).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // فقط `@AdminPublic()` معاف است. عمداً به `IS_PUBLIC_KEY` نگاه نمی‌شود: آن
    // کلید روی کل کنترلر ادمین هست تا گارد کاربر رد شود، و اگر اینجا هم شمرده
    // می‌شد، کل پنل بی‌احراز هویت باز می‌ماند.
    const adminPublic = this.reflector.getAllAndOverride<boolean>(ADMIN_PUBLIC_KEY, [
      context.getHandler(),
    ]);
    if (adminPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { admin?: unknown }>();
    const header = req.headers.authorization;
    const [scheme, value] = header?.split(' ') ?? [];
    if (!value || scheme?.toLowerCase() !== 'bearer') throw new AppError('unauthorized');

    const payload = await this.adminAuth.verify(value.trim());
    req.admin = { adminId: payload.sub, role: payload.role };
    return true;
  }
}

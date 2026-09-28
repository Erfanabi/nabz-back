import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, from, switchMap, tap } from 'rxjs';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { IDEMPOTENT_KEY } from './idempotency.decorator';

/**
 * `Idempotency-Key` را محترم می‌دارد: تکرار همان کلید عمل را دوباره اجرا نمی‌کند و
 * **همان نتیجهٔ قبلی را با ۲۰۰ (نه ۲۰۱)** برمی‌گرداند — API-SPEC §۲.۶.
 *
 * بدنهٔ درخواست هم هش می‌شود: اگر کلاینت همان کلید را با بدنهٔ متفاوت بفرستد،
 * عمل تازه اجرا می‌شود (کلید عوضی سهواً نتیجهٔ یک عمل دیگر را برنمی‌گرداند).
 *
 * نکته: `/sync/push` از این مسیر استفاده نمی‌کند — idempotency آن روی `op_id`
 * هر عمل است (§۶.۲) تا موفقیت جزئی حفظ شود.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();
    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key) return next.handle();

    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const userId = req.user?.userId ?? null;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');

    return from(
      this.prisma.idempotencyKey.findFirst({ where: { key, route, userId } }),
    ).pipe(
      switchMap((existing) => {
        if (existing && existing.requestHash === requestHash) {
          // تکرار همان کلید و همان بدنه → همان پاسخ، با ۲۰۰ نه ۲۰۱.
          res.status(200);
          return from([existing.responseBody as unknown]);
        }
        return next.handle().pipe(
          tap((payload) => {
            void this.store(key, route, userId, requestHash, res.statusCode, payload);
          }),
        );
      }),
    );
  }

  private async store(
    key: string,
    route: string,
    userId: string | null,
    requestHash: string,
    statusCode: number,
    payload: unknown,
  ): Promise<void> {
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          route,
          userId,
          requestHash,
          statusCode,
          responseBody: (payload ?? null) as never,
        },
      });
    } catch {
      // برخورد یکتایی یعنی درخواست همزمانِ دیگری زودتر ثبت کرده — مشکلی نیست.
    }
  }
}

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { ClockService } from './clock.service';

/**
 * لاگ درخواست‌ها **بدون دادهٔ مالی** (API-SPEC §۱۰ بند ۷).
 *
 * فقط متد، مسیر، کد وضعیت، مدت و `X-Request-Id` نوشته می‌شود. بدنه، هدر
 * `Authorization`، شماره موبایل، کد OTP و هیچ مبلغی وارد لاگ نمی‌شود — پس هیچ
 * نشتی از این مسیر ممکن نیست، حتی اگر کسی بعداً سطح لاگ را بالا ببرد.
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  constructor(private readonly clock: ClockService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = this.clock.nowMs();

    const requestId = req.headers['x-request-id'];
    const id = Array.isArray(requestId) ? requestId[0] : requestId;

    return next.handle().pipe(
      tap({
        next: () => this.write(req, res.statusCode, startedAt, id),
        error: () => this.write(req, res.statusCode, startedAt, id),
      }),
    );
  }

  private write(req: Request, status: number, startedAt: number, requestId?: string): void {
    const ms = this.clock.nowMs() - startedAt;
    const suffix = requestId ? ` req=${requestId}` : '';
    this.logger.log(`${req.method} ${req.path} ${status} ${ms}ms${suffix}`);
  }
}

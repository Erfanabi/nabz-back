import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ERROR_CATALOG, ErrorCode } from './errors';
import { ClockService } from './clock.service';

/**
 * همهٔ خطاها را به شکل واحد API-SPEC §۲.۴ درمی‌آورد، با پیام فارسی قابل نمایش.
 * خطاهای ناشناختهٔ Nest به نزدیک‌ترین کد کاتالوگ نقشه می‌شوند تا هیچ‌وقت
 * `ValidationError: field required` به کاربر نرسد.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  constructor(private readonly clock: ClockService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const body = this.toErrorBody(exception, req);
    const status = body.status;

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.path} → ${status} ${body.error.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (body.error.retry_after !== undefined) {
      res.setHeader('Retry-After', String(body.error.retry_after));
    }

    res.status(status).json({ error: body.error, server_time: this.clock.iso() });
  }

  private toErrorBody(
    exception: unknown,
    req: Request,
  ): { status: number; error: Record<string, unknown> } {
    if (exception instanceof AppError) {
      return {
        status: exception.getStatus(),
        error: exception.getResponse() as Record<string, unknown>,
      };
    }

    if (exception instanceof PayloadTooLargeException) {
      return this.fromCode('payload_too_large');
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      // خطای ValidationPipe: آرایه‌ای از پیام‌ها که ما قبلاً فارسی‌شان کرده‌ایم.
      if (typeof raw === 'object' && raw !== null && 'fields' in raw) {
        const r = raw as { fields?: Record<string, string>; code?: ErrorCode };
        return this.fromCode(r.code ?? 'validation_failed', { fields: r.fields });
      }

      const code = this.statusToCode(status);
      const def = ERROR_CATALOG[code];
      // پیام سفارشیِ فارسی اگر خودمان داده بودیم، وگرنه پیام کاتالوگ.
      const custom =
        typeof raw === 'object' && raw !== null && typeof (raw as any).message === 'string'
          ? (raw as any).message
          : undefined;
      const usableCustom = custom && /[؀-ۿ]/.test(custom) ? custom : undefined;
      return {
        status,
        error: {
          code,
          message: usableCustom ?? def.message,
          message_en: def.messageEn,
        },
      };
    }

    this.logger.error(`unhandled error on ${req.method} ${req.path}`);
    return this.fromCode('server_error');
  }

  private fromCode(
    code: ErrorCode,
    extra: { fields?: Record<string, string> } = {},
  ): { status: number; error: Record<string, unknown> } {
    const def = ERROR_CATALOG[code];
    return {
      status: def.status,
      error: {
        code,
        message: def.message,
        message_en: def.messageEn,
        ...(extra.fields ? { fields: extra.fields } : {}),
      },
    };
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case 400:
        return 'validation_failed';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 409:
        return 'sync_conflict';
      case 410:
        return 'cursor_expired';
      case 413:
        return 'payload_too_large';
      case 422:
        return 'validation_failed';
      case 429:
        return 'rate_limited';
      default:
        return status >= 500 ? 'server_error' : 'validation_failed';
    }
  }
}

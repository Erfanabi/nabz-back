import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ClockService } from './clock.service';

/** پاسخ‌هایی که خودشان پوشش نهایی‌اند و نباید دوباره پیچیده شوند (مثلاً فایل). */
export const RAW_RESPONSE = Symbol('raw_response');

/**
 * هر پاسخ موفق را به شکل `{ data, server_time }` درمی‌آورد (API-SPEC §۲.۲).
 *
 * `server_time` اجباری است: کلاینت اختلاف ساعت را یک‌بار حساب می‌کند و همهٔ
 * محاسبه‌های «روزهای باقی‌مانده» از آن می‌گذرد.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly clock: ClockService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        const res = context.switchToHttp().getResponse();
        if (res?.statusCode === 204 || payload === undefined || payload === null) {
          return payload;
        }
        if (typeof payload === 'object' && payload !== null && RAW_RESPONSE in (payload as object)) {
          return (payload as Record<string | symbol, unknown>)[RAW_RESPONSE];
        }
        return { data: payload, server_time: this.clock.iso() };
      }),
    );
  }
}

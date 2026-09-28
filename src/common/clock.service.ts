import { Injectable } from '@nestjs/common';

/**
 * تنها منبع زمان در سرور.
 *
 * هیچ جای دیگری `new Date()` یا `Date.now()` صدا زده نمی‌شود: زمان مرجع همهٔ
 * محاسبه‌های اشتراک ساعت سرور است (BACKEND-SPEC §۲.۳)، و تست‌ها باید بتوانند
 * زمان را جابه‌جا کنند تا «عوض کردن تاریخ گوشی دوره را کِش نمی‌دهد» قابل اثبات باشد.
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  nowMs(): number {
    return Date.now() + this.offsetMs;
  }

  iso(): string {
    return this.now().toISOString();
  }

  plusSeconds(seconds: number): Date {
    return new Date(this.nowMs() + seconds * 1000);
  }

  plusDays(days: number): Date {
    return new Date(this.nowMs() + days * 86_400_000);
  }

  /** فقط برای تست. */
  setOffsetMs(offset: number): void {
    this.offsetMs = offset;
  }
}

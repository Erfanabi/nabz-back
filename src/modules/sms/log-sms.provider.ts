import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';
import { maskPhone } from '../../common/phone';

/**
 * درایور توسعه: کد را در لاگ سرور چاپ می‌کند و هیچ پیامکی نمی‌فرستد.
 *
 * این تنها جایی در کل سیستم است که کد OTP به صورت خام دیده می‌شود، و فقط وقتی
 * `NODE_ENV` تولید نیست. در تولید استفاده از این درایور با هشدار همراه است.
 */
@Injectable()
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  private readonly logger = new Logger('Sms');

  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        `درایور پیامک روی log است و هیچ پیامکی ارسال نشد (${maskPhone(phone)}). SMS_DRIVER را تنظیم کنید.`,
      );
      return;
    }
    this.logger.log(`OTP برای ${maskPhone(phone)} → ${code}`);
  }
}

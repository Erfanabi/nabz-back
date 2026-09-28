import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';
import { AppConfigService } from '../../common/config/app-config.service';
import { maskPhone } from '../../common/phone';

/** درایور کاوه‌نگار (verify/lookup). کد در لاگ نمی‌آید. */
@Injectable()
export class KavenegarSmsProvider implements SmsProvider {
  readonly name = 'kavenegar';
  private readonly logger = new Logger('Sms');

  constructor(private readonly config: AppConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const url =
      `https://api.kavenegar.com/v1/${encodeURIComponent(this.config.kavenegarApiKey)}/verify/lookup.json` +
      `?receptor=${encodeURIComponent(phone)}&token=${encodeURIComponent(code)}` +
      `&template=${encodeURIComponent(this.config.kavenegarTemplate)}`;

    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      this.logger.error(`ارسال پیامک به ${maskPhone(phone)} ناموفق بود (HTTP ${res.status}).`);
      throw new Error(`kavenegar_http_${res.status}`);
    }
  }
}

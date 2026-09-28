import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';
import { AppConfigService } from '../../common/config/app-config.service';
import { maskPhone } from '../../common/phone';

/** درایور SMS.ir (verify/send). کد در لاگ نمی‌آید. */
@Injectable()
export class SmsIrSmsProvider implements SmsProvider {
  readonly name = 'smsir';
  private readonly logger = new Logger('Sms');

  constructor(private readonly config: AppConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const res = await fetch('https://api.sms.ir/v1/send/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': this.config.smsirApiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId: Number(this.config.smsirTemplateId),
        parameters: [{ name: 'CODE', value: code }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      this.logger.error(`ارسال پیامک به ${maskPhone(phone)} ناموفق بود (HTTP ${res.status}).`);
      throw new Error(`smsir_http_${res.status}`);
    }
  }
}

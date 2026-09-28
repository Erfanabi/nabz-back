import { Logger, Module } from '@nestjs/common';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';
import { LogSmsProvider } from './log-sms.provider';
import { KavenegarSmsProvider } from './kavenegar-sms.provider';
import { SmsIrSmsProvider } from './smsir-sms.provider';
import { AppConfigService } from '../../common/config/app-config.service';

@Module({
  providers: [
    LogSmsProvider,
    KavenegarSmsProvider,
    SmsIrSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [AppConfigService, LogSmsProvider, KavenegarSmsProvider, SmsIrSmsProvider],
      useFactory: (
        config: AppConfigService,
        log: LogSmsProvider,
        kavenegar: KavenegarSmsProvider,
        smsir: SmsIrSmsProvider,
      ): SmsProvider => {
        switch (config.smsDriver) {
          case 'kavenegar':
            return kavenegar;
          case 'smsir':
            return smsir;
          case 'log':
            return log;
          default:
            new Logger('Sms').warn(
              `درایور پیامک «${config.smsDriver}» شناخته نشد؛ درایور log استفاده می‌شود.`,
            );
            return log;
        }
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}

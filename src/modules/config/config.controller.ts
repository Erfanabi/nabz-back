import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from '../../common/config/app-config.service';
import { Public } from '../auth/public.decorator';

@ApiTags('config')
@Controller('config')
export class AppConfigController {
  constructor(private readonly config: AppConfigService) {}

  /**
   * کانفیگ عمومی؛ بدون توکن. برای تغییر رفتار بدون انتشار نسخهٔ جدید اپ.
   *
   * ⚠ `force_update` با احتیاط استفاده شود: اگر `true` بود و کاربر آفلاین بود،
   * اپ نباید قفل شود — کاربر باید بتواند دادهٔ مالی خودش را ببیند.
   */
  @Public()
  @Get('app')
  @ApiOperation({ summary: 'کانفیگ عمومی اپ' })
  app() {
    return this.config.appRuntimeConfig;
  }
}

import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncPushDto } from './dto/sync.dto';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.rules';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('snapshot')
  @ApiOperation({ summary: 'کل داده در یک پاسخ (ورود روی دستگاه تازه)' })
  async snapshot(@CurrentUser() user: AuthenticatedUser, @Query('cursor') cursor?: string) {
    return this.sync.snapshot(user.userId, cursor);
  }

  /**
   * صف تغییرات محلی.
   *
   * کد وضعیت همیشه ۲۰۰ است اگر بدنه معتبر بود؛ نتیجهٔ هر op در آرایهٔ `results`
   * می‌آید. یک op خراب کل دسته را رد نمی‌کند.
   */
  @Post('push')
  @RateLimit(RATE_LIMITS.syncPush)
  @HttpCode(200)
  @ApiOperation({ summary: 'ارسال دستهٔ تغییرات محلی' })
  async push(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncPushDto) {
    return this.sync.push(user.userId, dto.ops);
  }

  @Get('pull')
  @ApiOperation({ summary: 'دریافت دلتای تغییرات سرور' })
  async pull(@CurrentUser() user: AuthenticatedUser, @Query('cursor') cursor?: string) {
    return this.sync.pull(user.userId, cursor);
  }
}

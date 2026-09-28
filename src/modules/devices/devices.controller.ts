import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarkAlertsReadDto, PushTokenDto } from './dto/devices.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SyncService } from '../sync/sync.service';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';

@ApiTags('devices')
@Controller()
export class DevicesController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly sync: SyncService,
  ) {}

  @Post('devices/push-token')
  @Idempotent()
  @HttpCode(200)
  @ApiOperation({ summary: 'ثبت توکن اعلان دستگاه' })
  async registerToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushTokenDto) {
    return this.notifications.registerToken(
      user.userId,
      dto.device_id,
      dto.platform,
      dto.token,
      dto.app_version,
    );
  }

  /** همگام کردن پرچم «خوانده شد». در صف کلاینت می‌نشیند، پس idempotent است. */
  @Post('alerts/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'علامت‌گذاری هشدارها به‌عنوان خوانده‌شده' })
  async markRead(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkAlertsReadDto) {
    return this.sync.markAlertsRead(user.userId, dto.ids);
  }
}

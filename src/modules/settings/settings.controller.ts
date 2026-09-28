import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'تنظیمات همگام‌شو (بدون appLock و biometric)' })
  async get(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.get(user.userId);
  }

  @Put()
  @ApiOperation({ summary: 'ذخیرهٔ تنظیمات' })
  async update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user.userId, dto);
  }
}

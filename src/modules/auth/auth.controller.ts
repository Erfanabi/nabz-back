import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LogoutDto, OtpRequestDto, OtpVerifyDto, RefreshDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { AuthenticatedUser, CurrentUser } from './current-user.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { clientIp } from '../../common/client-ip';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * درخواست کد ورود.
   *
   * پاسخ برای شمارهٔ موجود و جدید **یکسان** است — شکل بدنه، کد وضعیت و زمان پاسخ.
   */
  @Public()
  // محدودیت نرخ درون سرویس روی شماره **و** IP اعمال می‌شود، چون شماره در بدنه است.
  @RateLimit(null)
  @Post('otp/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'ارسال کد یک‌بارمصرف' })
  async requestOtp(@Body() dto: OtpRequestDto, @Req() req: Request) {
    return this.auth.requestOtp(dto.phone, dto.device_id, clientIp(req));
  }

  @Public()
  @RateLimit(null)
  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'تأیید کد و ورود' })
  async verifyOtp(@Body() dto: OtpVerifyDto, @Req() req: Request) {
    const platform = this.platformFromClientHeader(req);
    return this.auth.verifyOtp(
      dto.phone,
      dto.code,
      dto.device_id ?? (req.headers['x-device-id'] as string | undefined),
      dto.device_name,
      platform,
      undefined,
    );
  }

  @Public()
  @Post('token/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'چرخش توکن' })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'خروج از همین دستگاه (دادهٔ محلی پاک نمی‌شود)' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto): Promise<void> {
    await this.auth.logout(user.userId, dto.refresh_token);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'فهرست جلسه‌های فعال' })
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'قطع جلسهٔ یک دستگاه' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.auth.revokeSession(user.userId, id);
  }

  /** پلتفرم از هدر `X-Client` مثل `nabz-app/1.0.0 (android 14)` بیرون کشیده می‌شود. */
  private platformFromClientHeader(req: Request): string | undefined {
    const raw = req.headers['x-client'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const match = value?.match(/\((android|ios|web)[^)]*\)/i);
    return match?.[1]?.toLowerCase();
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsNotEmpty } from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({ example: '09121234567', description: 'هر قالبی پذیرفته می‌شود و سرور نرمال می‌کند' })
  @IsString({ message: 'شماره موبایل باید متن باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل لازم است.' })
  phone: string;

  @ApiPropertyOptional({ description: 'شناسهٔ پایدار دستگاه، تولید کلاینت' })
  @IsOptional()
  @IsString({ message: 'شناسهٔ دستگاه باید متن باشد.' })
  @MaxLength(200, { message: 'شناسهٔ دستگاه بیش از حد بلند است.' })
  device_id?: string;
}

export class OtpVerifyDto {
  @ApiProperty({ example: '09121234567' })
  @IsString({ message: 'شماره موبایل باید متن باشد.' })
  @IsNotEmpty({ message: 'شماره موبایل لازم است.' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: 'کد باید متن باشد.' })
  @IsNotEmpty({ message: 'کد تأیید لازم است.' })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'شناسهٔ دستگاه باید متن باشد.' })
  @MaxLength(200, { message: 'شناسهٔ دستگاه بیش از حد بلند است.' })
  device_id?: string;

  @ApiPropertyOptional({ example: 'Pixel 8' })
  @IsOptional()
  @IsString({ message: 'نام دستگاه باید متن باشد.' })
  @MaxLength(120, { message: 'نام دستگاه بیش از حد بلند است.' })
  device_name?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString({ message: 'توکن باید متن باشد.' })
  @IsNotEmpty({ message: 'توکن لازم است.' })
  refresh_token: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString({ message: 'توکن باید متن باشد.' })
  @IsNotEmpty({ message: 'توکن لازم است.' })
  refresh_token: string;
}

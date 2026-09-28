import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class PushTokenDto {
  @ApiProperty()
  @IsString({ message: 'شناسهٔ دستگاه باید متن باشد.' })
  @IsNotEmpty({ message: 'شناسهٔ دستگاه لازم است.' })
  @MaxLength(200, { message: 'شناسهٔ دستگاه بیش از حد بلند است.' })
  device_id: string;

  @ApiProperty({ enum: ['android', 'ios', 'web'] })
  @IsIn(['android', 'ios', 'web'], { message: 'پلتفرم معتبر نیست.' })
  platform: string;

  @ApiProperty({ example: 'ExponentPushToken[xxx]' })
  @IsString({ message: 'توکن باید متن باشد.' })
  @IsNotEmpty({ message: 'توکن اعلان لازم است.' })
  @MaxLength(400, { message: 'توکن اعلان بیش از حد بلند است.' })
  token: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString({ message: 'نسخهٔ اپ باید متن باشد.' })
  @MaxLength(30, { message: 'نسخهٔ اپ بیش از حد بلند است.' })
  app_version?: string;
}

export class MarkAlertsReadDto {
  @ApiProperty({ type: [String] })
  @IsArray({ message: 'فهرست شناسه‌ها باید آرایه باشد.' })
  @ArrayMaxSize(500, { message: 'در هر درخواست حداکثر ۵۰۰ شناسه می‌توان فرستاد.' })
  @IsString({ each: true, message: 'شناسهٔ هشدار باید متن باشد.' })
  ids: string[];
}

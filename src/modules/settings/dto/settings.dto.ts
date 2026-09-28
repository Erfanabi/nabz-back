import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AlertSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) budgetNear?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) budgetOver?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) spendingSpike?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) recurringDue?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) balanceDrop?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) goalBehind?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) savingRateDown?: boolean;
}

/**
 * تنظیمات همگام‌شو.
 *
 * `appLock` و `biometric` عمداً اینجا نیستند: تنظیم امنیتیِ همان دستگاه‌اند و
 * به سرور نمی‌روند (API-SPEC §۷.۱). هر کلید ناشناسی هم با `whitelist` حذف می‌شود.
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['jalali', 'gregorian'] })
  @IsOptional()
  @IsIn(['jalali', 'gregorian'], { message: 'نوع تقویم معتبر نیست.' })
  calendar?: string;

  @ApiPropertyOptional({ enum: ['fa', 'latin'] })
  @IsOptional()
  @IsIn(['fa', 'latin'], { message: 'نوع ارقام معتبر نیست.' })
  digits?: string;

  @ApiPropertyOptional({ enum: ['sat', 'mon'] })
  @IsOptional()
  @IsIn(['sat', 'mon'], { message: 'روز شروع هفته معتبر نیست.' })
  weekStart?: string;

  @ApiPropertyOptional({ enum: ['bars', 'donut'] })
  @IsOptional()
  @IsIn(['bars', 'donut'], { message: 'نوع نمودار گزارش معتبر نیست.' })
  reportChart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'باید بله یا خیر باشد.' })
  reportStory?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject({ message: 'بخش‌های صفحهٔ خانه باید یک شیء باشد.' })
  homeSections?: Record<string, boolean>;

  @ApiPropertyOptional({ description: 'ثانیه' })
  @IsOptional()
  @IsInt({ message: 'زمان قفل خودکار باید عدد صحیح (ثانیه) باشد.' })
  @Min(0, { message: 'زمان قفل خودکار نمی‌تواند منفی باشد.' })
  @Max(86_400, { message: 'زمان قفل خودکار بیش از حد بزرگ است.' })
  autoLock?: number;

  @ApiPropertyOptional({ description: 'پیش‌فرض خاموش؛ دادهٔ ارسالی تجمیعی و بی‌نام است' })
  @IsOptional()
  @IsBoolean({ message: 'باید بله یا خیر باشد.' })
  benchmarking?: boolean;

  @ApiPropertyOptional({ description: 'روشن شدن آن همگام‌سازی را غیرفعال و دادهٔ سرور را پاک می‌کند' })
  @IsOptional()
  @IsBoolean({ message: 'باید بله یا خیر باشد.' })
  localOnly?: boolean;

  @ApiPropertyOptional({ type: AlertSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AlertSettingsDto)
  alerts?: AlertSettingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'باید بله یا خیر باشد.' })
  quietHours?: boolean;

  @ApiPropertyOptional({ example: '22:00', description: 'ارقام لاتین، قالب HH:mm' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'ساعت باید به قالب HH:mm و با ارقام لاتین باشد.' })
  quietFrom?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'ساعت باید به قالب HH:mm و با ارقام لاتین باشد.' })
  quietTo?: string;

  @ApiPropertyOptional({ example: 'Asia/Tehran', description: 'برای احترام به ساعت آرام در push' })
  @IsOptional()
  @Matches(/^[A-Za-z]+\/[A-Za-z_+\-0-9]+$/, { message: 'منطقهٔ زمانی معتبر نیست.' })
  timezone?: string;
}

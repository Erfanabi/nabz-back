import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@nabz.ir' })
  @IsEmail({}, { message: 'ایمیل معتبر نیست.' })
  email: string;

  @ApiProperty()
  @IsString({ message: 'رمز عبور باید متن باشد.' })
  @IsNotEmpty({ message: 'رمز عبور لازم است.' })
  password: string;
}

export class RejectRequestDto {
  @ApiProperty({ example: 'مبلغ واریزی با مبلغ پلن نمی‌خواند.' })
  @IsString({ message: 'دلیل رد باید متن باشد.' })
  @IsNotEmpty({ message: 'دلیل رد را بنویس؛ کاربر باید بداند چرا رد شد.' })
  @MaxLength(400, { message: 'دلیل رد بیش از حد بلند است.' })
  reason: string;
}

export class GrantPlanDto {
  @ApiProperty({ example: 'pro' })
  @IsString({ message: 'کلید پلن باید متن باشد.' })
  @IsNotEmpty({ message: 'پلن لازم است.' })
  plan_key: string;

  @ApiProperty({ example: 30 })
  @IsInt({ message: 'مدت باید عدد صحیح روز باشد.' })
  @Min(1, { message: 'مدت باید حداقل یک روز باشد.' })
  duration_days: number;

  @ApiPropertyOptional({ example: 'جبران اختلال سرویس' })
  @IsOptional()
  @IsString({ message: 'توضیح باید متن باشد.' })
  @MaxLength(400, { message: 'توضیح بیش از حد بلند است.' })
  note?: string;
}

// ───────────── ویرایش کاتالوگ ─────────────

export class CatalogPlanDto {
  @ApiProperty() @IsString({ message: 'کلید پلن باید متن باشد.' }) key: string;
  @ApiProperty() @IsString({ message: 'عنوان پلن باید متن باشد.' }) title: string;
  @ApiProperty() @IsInt({ message: 'tier باید عدد صحیح باشد.' }) tier: number;
  @ApiProperty() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) is_purchasable: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString({ message: 'شرح پلن باید متن باشد.' }) pitch?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray({ message: 'نکته‌های برجسته باید آرایه باشد.' })
  @IsString({ each: true, message: 'هر نکته باید متن باشد.' })
  highlights?: string[];
}

export class CatalogPriceDto {
  @ApiProperty() @IsString({ message: 'کلید پلن باید متن باشد.' }) plan_key: string;
  @ApiProperty() @IsInt({ message: 'مدت باید عدد صحیح روز باشد.' }) @Min(1, { message: 'مدت باید حداقل یک روز باشد.' }) duration_days: number;
  @ApiProperty({ description: 'تومان، عدد صحیح' })
  @IsInt({ message: 'مبلغ باید عدد صحیح به تومان باشد.' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد.' })
  amount_toman: number;
}

export class CatalogLimitDto {
  @ApiProperty() @IsString({ message: 'کلید سقف باید متن باشد.' }) key: string;
  @ApiProperty() @IsString({ message: 'برچسب سقف باید متن باشد.' }) label: string;
  @ApiPropertyOptional({ description: 'null = نامحدود' }) @IsOptional() @IsInt({ message: 'سقف باید عدد صحیح یا null باشد.' }) free?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt({ message: 'سقف باید عدد صحیح یا null باشد.' }) plus?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt({ message: 'سقف باید عدد صحیح یا null باشد.' }) pro?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) soon?: boolean;
}

export class CatalogFeatureDto {
  @ApiProperty() @IsString({ message: 'کلید قابلیت باید متن باشد.' }) key: string;
  @ApiProperty() @IsString({ message: 'برچسب قابلیت باید متن باشد.' }) label: string;
  @ApiProperty({ description: '۱ باز، ۰ بسته' }) @IsIn([0, 1], { message: 'مقدار قابلیت باید ۰ یا ۱ باشد.' }) free: number;
  @ApiProperty() @IsIn([0, 1], { message: 'مقدار قابلیت باید ۰ یا ۱ باشد.' }) plus: number;
  @ApiProperty() @IsIn([0, 1], { message: 'مقدار قابلیت باید ۰ یا ۱ باشد.' }) pro: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean({ message: 'باید بله یا خیر باشد.' }) soon?: boolean;
}

/** فیلدهای غایب تغییر نمی‌کنند؛ آرایهٔ فرستاده‌شده جای آرایهٔ قبلی را می‌گیرد. */
export class UpdateCatalogDto {
  @ApiPropertyOptional({ type: [CatalogPlanDto] })
  @IsOptional() @IsArray({ message: 'فهرست پلن‌ها باید آرایه باشد.' })
  @ValidateNested({ each: true }) @Type(() => CatalogPlanDto)
  plans?: CatalogPlanDto[];

  @ApiPropertyOptional({ type: [CatalogPriceDto] })
  @IsOptional() @IsArray({ message: 'فهرست قیمت‌ها باید آرایه باشد.' })
  @ValidateNested({ each: true }) @Type(() => CatalogPriceDto)
  prices?: CatalogPriceDto[];

  @ApiPropertyOptional({ type: [CatalogLimitDto] })
  @IsOptional() @IsArray({ message: 'فهرست سقف‌ها باید آرایه باشد.' })
  @ValidateNested({ each: true }) @Type(() => CatalogLimitDto)
  limits?: CatalogLimitDto[];

  @ApiPropertyOptional({ type: [CatalogFeatureDto] })
  @IsOptional() @IsArray({ message: 'فهرست قابلیت‌ها باید آرایه باشد.' })
  @ValidateNested({ each: true }) @Type(() => CatalogFeatureDto)
  features?: CatalogFeatureDto[];
}

export class CreateAdminDto {
  @ApiProperty() @IsEmail({}, { message: 'ایمیل معتبر نیست.' }) email: string;
  @ApiProperty() @IsString({ message: 'رمز عبور باید متن باشد.' })
  @MinLength(12, { message: 'رمز عبور ادمین باید حداقل ۱۲ کاراکتر باشد.' })
  password: string;
  @ApiPropertyOptional() @IsOptional() @IsString({ message: 'نام باید متن باشد.' }) name?: string;
}

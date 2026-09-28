import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsOptional, Matches } from 'class-validator';

export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export const EXPORT_SECTIONS = ['transactions', 'budgets', 'goals', 'accounts'] as const;

export class ExportDto {
  @ApiProperty({ enum: EXPORT_FORMATS })
  @IsIn(EXPORT_FORMATS as unknown as string[], { message: 'قالب خروجی معتبر نیست.' })
  format: string;

  @ApiPropertyOptional({ example: '2026-08-23', description: 'تاریخ میلادی' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاریخ شروع باید به قالب YYYY-MM-DD میلادی باشد.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-22' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاریخ پایان باید به قالب YYYY-MM-DD میلادی باشد.' })
  to?: string;

  @ApiPropertyOptional({ enum: EXPORT_SECTIONS, isArray: true })
  @IsOptional()
  @IsArray({ message: 'بخش‌های خروجی باید آرایه باشد.' })
  @ArrayMinSize(1, { message: 'حداقل یک بخش برای خروجی انتخاب کن.' })
  @IsIn(EXPORT_SECTIONS as unknown as string[], { each: true, message: 'بخش انتخاب‌شده معتبر نیست.' })
  include?: string[];
}

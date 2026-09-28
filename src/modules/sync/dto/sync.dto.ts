import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';

export const SYNC_ENTITIES = [
  'transaction',
  'account',
  'category',
  'budget',
  'goal',
  'recurring',
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_ACTIONS = ['create', 'update', 'delete'] as const;
export type SyncAction = (typeof SYNC_ACTIONS)[number];

/** سقف اندازهٔ دسته (API-SPEC §۶.۲ بند ۶). */
export const SYNC_MAX_OPS = 500;

export class SyncOpDto {
  @ApiProperty({ description: 'UUID تولید کلاینت؛ مبنای idempotency' })
  @IsString({ message: 'شناسهٔ عمل باید متن باشد.' })
  @IsNotEmpty({ message: 'شناسهٔ عمل لازم است.' })
  op_id: string;

  @ApiProperty({ enum: SYNC_ENTITIES })
  @IsIn(SYNC_ENTITIES as unknown as string[], { message: 'نوع موجودیت معتبر نیست.' })
  entity: SyncEntity;

  @ApiProperty({ enum: SYNC_ACTIONS })
  @IsIn(SYNC_ACTIONS as unknown as string[], { message: 'نوع عمل معتبر نیست.' })
  action: SyncAction;

  @ApiProperty({ description: 'epoch milliseconds — مبنای حل تعارض' })
  @IsInt({ message: 'زمان تغییر باید عدد صحیح (میلی‌ثانیه) باشد.' })
  client_updated_at: number;

  @ApiProperty({ type: Object })
  @IsObject({ message: 'محتوای عمل باید یک شیء باشد.' })
  payload: Record<string, unknown>;
}

export class SyncPushDto {
  @ApiPropertyOptional({ example: 'c_000871' })
  @IsOptional()
  @IsString({ message: 'نشانگر همگام‌سازی باید متن باشد.' })
  base_cursor?: string;

  @ApiProperty({ type: [SyncOpDto] })
  @IsArray({ message: 'فهرست تغییرات باید آرایه باشد.' })
  @ArrayMaxSize(SYNC_MAX_OPS, {
    message: `در هر دسته حداکثر ${SYNC_MAX_OPS} تغییر می‌توان فرستاد.`,
  })
  @ValidateNested({ each: true })
  @Type(() => SyncOpDto)
  ops: SyncOpDto[];
}

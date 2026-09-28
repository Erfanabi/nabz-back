import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'سارا' })
  @IsOptional()
  @IsString({ message: 'نام باید متن باشد.' })
  @MaxLength(80, { message: 'نام بیش از حد بلند است.' })
  display_name?: string | null;
}

export class DeleteMeDto {
  @ApiProperty({ example: true, description: 'تأیید صریح کاربر لازم است' })
  @Equals(true, { message: 'برای حذف حساب باید تأیید کنی.' })
  confirm: boolean;
}

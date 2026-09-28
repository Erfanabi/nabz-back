import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreatePaymentRequestDto {
  @ApiProperty({ example: 'plus' })
  @IsString({ message: 'کلید پلن باید متن باشد.' })
  @IsNotEmpty({ message: 'پلن را انتخاب کن.' })
  plan_key: string;

  @ApiProperty({ example: 90 })
  @IsInt({ message: 'مدت اشتراک باید عدد صحیح روز باشد.' })
  duration_days: number;

  @ApiPropertyOptional({ example: 'manual_card' })
  @IsOptional()
  @IsString({ message: 'روش پرداخت باید متن باشد.' })
  provider?: string;
}

export class SubmitReceiptDto {
  @ApiProperty({ example: 'telegram', enum: ['sms', 'telegram', 'whatsapp', 'in_app'] })
  @IsString({ message: 'کانال ارسال رسید باید متن باشد.' })
  @IsIn(['sms', 'telegram', 'whatsapp', 'in_app'], { message: 'کانال ارسال رسید معتبر نیست.' })
  channel: string;

  @ApiPropertyOptional({ example: 'واریز از کارت ۶۰۳۷…۱۲۳۴ ساعت ۱۴:۳۰' })
  @IsOptional()
  @IsString({ message: 'توضیح باید متن باشد.' })
  @MaxLength(500, { message: 'توضیح بیش از حد بلند است.' })
  note?: string;
}

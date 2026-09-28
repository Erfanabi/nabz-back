import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExportService } from './export.service';
import { ExportDto } from './dto/export.dto';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('export')
@Controller('export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  /** پاسخ ۲۰۰ با URL امضاشدهٔ کوتاه‌عمر (۱۵ دقیقه). */
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'ساخت خروجی CSV یا اکسل' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ExportDto) {
    return this.exports.create(user.userId, dto.format, dto.from, dto.to, dto.include);
  }
}

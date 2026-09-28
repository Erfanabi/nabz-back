import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { Public } from '../auth/public.decorator';
import { AppError } from '../../common/errors';
import { RAW_RESPONSE } from '../../common/envelope.interceptor';

/**
 * تحویل فایل خصوصی با URL امضاشده.
 *
 * بدون توکن است چون خود امضا مجوز است (و کوتاه‌عمر)، اما هیچ مسیری برای فهرست
 * کردن یا حدس زدن فایل‌ها وجود ندارد.
 */
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async serve(
    @Query('path') path: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!path || !expires || !sig) throw new AppError('not_found');
    this.storage.verifySignature(path, Number(expires), sig);
    const buffer = await this.storage.read(path);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'attachment');
    res.send(buffer);
    return { [RAW_RESPONSE]: undefined };
  }
}

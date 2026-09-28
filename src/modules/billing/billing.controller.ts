import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentRequestStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { CatalogService } from './catalog.service';
import { EntitlementsService } from './entitlements.service';
import { PaymentRequestsService, RECEIPT_MAX_BYTES } from './payment-requests.service';
import { CreatePaymentRequestDto, SubmitReceiptDto } from './dto/billing.dto';
import { Public } from '../auth/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';
import { AppError } from '../../common/errors';
import { AppConfigService } from '../../common/config/app-config.service';

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly entitlements: EntitlementsService,
    private readonly requests: PaymentRequestsService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * کل کاتالوگ در یک پاسخ.
   *
   * بدون توکن قابل فراخوانی است چون صفحهٔ پلن‌ها ممکن است قبل از ورود دیده شود.
   * `ETag` می‌گذارد تا کلاینت تا تغییر واقعی کاتالوگ دوباره دانلود نکند.
   */
  @Public()
  @Get('billing/plans')
  @ApiOperation({ summary: 'کاتالوگ پلن‌ها، قیمت‌ها، سقف‌ها و ماتریس قابلیت' })
  async plans(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = await this.catalog.build();
    const etag = this.catalog.etagFor(payload);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }
    return payload;
  }

  /**
   * اطلاعات پرداخت کارت‌به‌کارت — هرگز در کد اپ ثابت نمی‌شود.
   *
   * برخلاف کاتالوگ، این مسیر **توکن می‌خواهد** (API-SPEC §۱ ردیف ۱۱): شمارهٔ کارت
   * و نام صاحب حساب نباید بی‌احراز هویت در دسترس باشد.
   */
  @Get('billing/config')
  @ApiOperation({ summary: 'اطلاعات واریز کارت‌به‌کارت' })
  billingConfig() {
    return this.config.billingConfig;
  }

  @Get('me/entitlements')
  @ApiOperation({ summary: 'وضعیت اشتراک کاربر' })
  async myEntitlements(@CurrentUser() user: AuthenticatedUser) {
    return this.entitlements.payload(user.userId);
  }

  @Post('billing/trial')
  @Idempotent()
  @HttpCode(200)
  @ApiOperation({ summary: 'شروع دورهٔ آزمایشی (یک‌بار برای هر شماره)' })
  async startTrial(@CurrentUser() user: AuthenticatedUser) {
    return this.entitlements.startTrial(user.userId);
  }

  @Post('billing/payment-requests')
  @Idempotent()
  @ApiOperation({ summary: 'ساخت درخواست پرداخت (کد پیگیری ۶ کاراکتری)' })
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { request, created } = await this.requests.create(
      user.userId,
      dto.plan_key,
      dto.duration_days,
      dto.provider ?? 'manual_card',
    );
    // درخواست pending موجود با ۲۰۰ برمی‌گردد، درخواست تازه با ۲۰۱.
    res.status(created ? 201 : 200);
    return request;
  }

  @Get('billing/payment-requests')
  @ApiOperation({ summary: 'تاریخچهٔ درخواست‌های پرداخت' })
  async listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const allowed: PaymentRequestStatus[] = [
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'expired',
    ];
    if (status && !allowed.includes(status as PaymentRequestStatus)) {
      throw new AppError('validation_failed', {
        fields: { status: 'وضعیت انتخاب‌شده معتبر نیست.' },
      });
    }
    return this.requests.list(
      user.userId,
      status as PaymentRequestStatus | undefined,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  @Get('billing/payment-requests/:id')
  @ApiOperation({ summary: 'وضعیت یک درخواست پرداخت' })
  async getRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requests.get(user.userId, id);
  }

  /**
   * اعلام ارسال رسید. هم JSON ساده و هم `multipart/form-data` با فایل را می‌پذیرد.
   * فایل در استوریج خصوصی می‌نشیند، نه در مسیر عمومی.
   */
  @Post('billing/payment-requests/:id/receipt')
  @Idempotent()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: RECEIPT_MAX_BYTES } }))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'اعلام ارسال رسید' })
  async submitReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitReceiptDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.requests.submitReceipt(user.userId, id, dto.channel, dto.note, file);
  }

  @Post('billing/payment-requests/:id/cancel')
  @Idempotent()
  @HttpCode(200)
  @ApiOperation({ summary: 'لغو درخواست پرداخت' })
  async cancelRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requests.cancel(user.userId, id);
  }
}

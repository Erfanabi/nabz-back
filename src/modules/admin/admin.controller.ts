import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentRequestStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import {
  AdminLoginDto,
  CreateAdminDto,
  GrantPlanDto,
  RejectRequestDto,
  UpdateCatalogDto,
} from './dto/admin.dto';
import { AuthenticatedAdmin, CurrentAdmin } from './current-admin.decorator';
import { Public } from '../auth/public.decorator';
import { AdminPublic } from './admin-public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.rules';
import { AppError } from '../../common/errors';

/**
 * پنل ادمین.
 *
 * `AdminGuard` روی کل کنترلر است و **جای** گارد توکن کاربر را می‌گیرد، پس هیچ
 * توکن کاربری این مسیرها را باز نمی‌کند. تغییر entitlement فقط از همین‌جا ممکن است.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Public() // گارد سراسری کاربر رد می‌شود…
@UseGuards(AdminGuard) // …و به‌جایش گارد ادمین اعمال می‌شود.
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  @AdminPublic()
  @RateLimit(RATE_LIMITS.adminLogin)
  @Post('auth/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'ورود ادمین با ایمیل و رمز عبور' })
  async login(@Body() dto: AdminLoginDto) {
    return this.adminAuth.login(dto.email, dto.password);
  }

  @Post('admins')
  @HttpCode(201)
  @ApiOperation({ summary: 'ساخت ادمین تازه' })
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminAuth.create(dto.email, dto.password, dto.name);
  }

  @Get('payment-requests')
  @ApiOperation({ summary: 'فهرست درخواست‌های پرداخت' })
  async listRequests(
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
    return this.admin.listRequests(
      status as PaymentRequestStatus | undefined,
      limit ? Number(limit) : 50,
      cursor,
    );
  }

  @Post('payment-requests/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'تأیید واریزی (ارتقا فوری، تمدید/تنزل صف‌شده)' })
  async approve(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.admin.approve(admin.adminId, id);
  }

  @Post('payment-requests/:id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'رد واریزی با دلیل' })
  async reject(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: RejectRequestDto,
  ) {
    return this.admin.reject(admin.adminId, id, dto.reason);
  }

  @Post('users/:id/grant')
  @HttpCode(200)
  @ApiOperation({ summary: 'اعطای دستی پلن (source: admin_grant)' })
  async grant(@Param('id') id: string, @Body() dto: GrantPlanDto) {
    return this.admin.grant(id, dto.plan_key, dto.duration_days, dto.note);
  }

  @Get('users')
  @ApiOperation({ summary: 'جستجوی کاربر' })
  async users(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.findUsers(q, limit ? Number(limit) : 20);
  }

  @Put('billing/catalog')
  @ApiOperation({ summary: 'ویرایش پلن، قیمت، سقف و ماتریس قابلیت' })
  async updateCatalog(@Body() dto: UpdateCatalogDto) {
    return this.admin.updateCatalog(dto);
  }
}

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './common/config/app-config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { FilesModule } from './modules/files/files.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BillingModule } from './modules/billing/billing.module';
import { SyncModule } from './modules/sync/sync.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DevicesModule } from './modules/devices/devices.module';
import { ExportModule } from './modules/export/export.module';
import { RuntimeConfigModule } from './modules/config/config.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { RequestLogInterceptor } from './common/request-log.interceptor';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { AppExceptionFilter } from './common/app-exception.filter';
import { AccessTokenGuard } from './modules/auth/access-token.guard';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';

/**
 * مونولیت ماژولار.
 *
 * ترتیب گاردها و اینترسپتورها معنا دارد:
 *  - گارد توکن **قبل از** گارد نرخ می‌آید تا محدودیت نرخ بر مبنای شناسهٔ کاربر
 *    اعمال شود، نه IP مشترک اپراتور موبایل (که کل کاربران یک اپراتور را
 *    به‌هم گره می‌زد).
 *  - `EnvelopeInterceptor` بیرونی‌ترین است تا `server_time` روی پاسخ idempotent
 *    بازگردانده‌شده هم **تازه** باشد.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RateLimitModule,
    FilesModule,
    AuthModule,
    UsersModule,
    BillingModule,
    SyncModule,
    SettingsModule,
    DevicesModule,
    NotificationsModule,
    ExportModule,
    RuntimeConfigModule,
    AdminModule,
    MaintenanceModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule.register({}), BillingModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthService, AdminGuard],
  exports: [AdminAuthService],
})
export class AdminModule {}

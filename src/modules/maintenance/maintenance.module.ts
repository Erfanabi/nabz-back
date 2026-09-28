import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { MaintenanceService } from './maintenance.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { SmsModule } from '../sms/sms.module';
import { OtpService } from '../auth/otp.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.register({}),
    SmsModule,
    AuthModule,
    UsersModule,
    BillingModule,
  ],
  providers: [MaintenanceService, OtpService],
})
export class MaintenanceModule {}

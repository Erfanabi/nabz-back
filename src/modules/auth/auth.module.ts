import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { SmsModule } from '../sms/sms.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [JwtModule.register({}), SmsModule, BillingModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService],
  exports: [TokenService, AuthService],
})
export class AuthModule {}

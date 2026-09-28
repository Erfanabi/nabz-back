import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { ClockService } from '../clock.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  providers: [AppConfigService, ClockService],
  exports: [AppConfigService, ClockService],
})
export class AppConfigModule {}

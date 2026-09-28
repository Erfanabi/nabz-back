import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [NotificationsModule, SyncModule],
  controllers: [DevicesController],
})
export class DevicesModule {}

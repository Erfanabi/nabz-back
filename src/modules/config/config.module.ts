import { Module } from '@nestjs/common';
import { AppConfigController } from './config.controller';

@Module({ controllers: [AppConfigController] })
export class RuntimeConfigModule {}

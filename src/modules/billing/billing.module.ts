import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { CatalogService } from './catalog.service';
import { EntitlementsService } from './entitlements.service';
import { PaymentRequestsService } from './payment-requests.service';

@Module({
  controllers: [BillingController],
  providers: [CatalogService, EntitlementsService, PaymentRequestsService],
  exports: [CatalogService, EntitlementsService, PaymentRequestsService],
})
export class BillingModule {}

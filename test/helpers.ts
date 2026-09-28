import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { buildValidationPipe } from '../src/common/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../src/modules/sms/sms.provider';

/** درایور پیامک تستی: کد را نگه می‌دارد تا تست بتواند واقعاً وارد شود. */
export class CapturingSmsProvider implements SmsProvider {
  readonly name = 'capture';
  readonly sent: Array<{ phone: string; code: string }> = [];

  async sendOtp(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }

  lastCodeFor(phone: string): string {
    const entry = [...this.sent].reverse().find((s) => s.phone === phone);
    if (!entry) throw new Error(`هیچ کدی برای ${phone} ارسال نشده بود`);
    return entry.code;
  }
}

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  sms: CapturingSmsProvider;
}

export async function createTestApp(): Promise<TestContext> {
  const sms = new CapturingSmsProvider();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SMS_PROVIDER)
    .useValue(sms)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(buildValidationPipe());
  await app.init();

  return { app, prisma: app.get(PrismaService), sms };
}

/** شمارهٔ یکتا برای هر تست تا محدودیت نرخ بین تست‌ها سرریز نکند. */
export function uniquePhone(): string {
  const suffix = String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0');
  return `091${suffix}`;
}

export const uuid = (): string => randomUUID();

/** پاک کردن دادهٔ یک شماره — تست‌ها روی هم اثر نگذارند. */
export async function cleanupPhone(prisma: PrismaService, phone: string): Promise<void> {
  await prisma.otpChallenge.deleteMany({ where: { phone } });
  await prisma.user.deleteMany({ where: { phone } });
}

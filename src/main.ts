import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildValidationPipe } from './common/validation.pipe';
import { AppConfigService } from './common/config/app-config.service';

/** پاسخ‌های JSON بزرگ‌ترِ sync نباید از سقف پیش‌فرض ۱۰۰KB اکسپرس رد شوند. */
const BODY_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(buildValidationPipe());

  // TLS در لایهٔ پروکسی تمام می‌شود؛ HSTS از همین‌جا اعلام می‌شود.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    }),
  );

  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // اپ موبایل از مرورگر نمی‌آید؛ CORS فقط برای پنل ادمین و ابزار توسعه باز است.
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()) ?? true,
    credentials: false,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept-Language',
      'X-Client',
      'X-Device-Id',
      'X-Request-Id',
      'Idempotency-Key',
      'If-None-Match',
    ],
    exposedHeaders: ['ETag', 'Retry-After'],
  });

  const express = app.getHttpAdapter().getInstance();
  express.set('x-powered-by', false);
  const bodyParser = await import('express');
  express.use(bodyParser.json({ limit: BODY_LIMIT }));

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('نبض — API')
        .setDescription(
          'وب‌سرویس اپ مدیریت مالی شخصی نبض. پول همیشه تومان و عدد صحیح؛ تاریخ همیشه ISO 8601 یا epoch ms.',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`مستندات روی /docs باز است.`);
  }

  await app.listen(config.port, '0.0.0.0');
  logger.log(`نبض روی پورت ${config.port} بالا آمد (درایور پیامک: ${config.smsDriver}).`);
}

void bootstrap();

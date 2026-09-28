import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppError } from '../../common/errors';

export interface AdminTokenPayload {
  sub: string;
  role: string;
  typ: 'admin';
}

/**
 * احراز هویت ادمین — کاملاً جدا از جریان کاربر.
 *
 * دلیل جدایی: کاربر با OTP وارد می‌شود و هیچ رمزی ندارد؛ اگر نقش ادمین روی همان
 * جریان می‌نشست، دسترسی به یک سیم‌کارت کافی بود تا کسی entitlement همه را عوض
 * کند. توکن ادمین امضای جداگانه دارد، پس توکن کاربر هیچ‌وقت مسیر ادمین را باز
 * نمی‌کند و برعکس.
 */
@Injectable()
export class AdminAuthService {
  /** عمر توکن ادمین کوتاه است؛ پنل با ورود دوباره ادامه می‌دهد. */
  private static readonly TTL_SECONDS = 8 * 3600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // مقایسه همیشه انجام می‌شود تا وجود یا نبود ایمیل از زمان پاسخ فهمیده نشود.
    const hash = admin?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const matches = await bcrypt.compare(password, hash);

    if (!admin || !matches || admin.disabledAt !== null) {
      throw new AppError('unauthorized', {
        message: 'ایمیل یا رمز عبور درست نیست.',
        messageEn: 'Invalid credentials.',
      });
    }

    const token = await this.jwt.signAsync(
      { sub: admin.id, role: admin.role, typ: 'admin' } satisfies AdminTokenPayload,
      { secret: this.config.adminSecret, expiresIn: AdminAuthService.TTL_SECONDS },
    );

    return {
      access_token: token,
      access_expires_in: AdminAuthService.TTL_SECONDS,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    };
  }

  async verify(token: string): Promise<AdminTokenPayload> {
    let payload: AdminTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminTokenPayload>(token, {
        secret: this.config.adminSecret,
      });
    } catch {
      throw new AppError('unauthorized');
    }
    if (payload.typ !== 'admin') throw new AppError('unauthorized');

    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin || admin.disabledAt !== null) throw new AppError('unauthorized');
    return payload;
  }

  /** ساخت ادمین — فقط به‌دست ادمین موجود یا اسکریپت seed. */
  async create(email: string, password: string, name?: string) {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.adminUser.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new AppError('validation_failed', {
        message: 'ادمینی با این ایمیل از قبل هست.',
        fields: { email: 'این ایمیل تکراری است.' },
      });
    }
    const admin = await this.prisma.adminUser.create({
      data: {
        email: normalized,
        passwordHash: await bcrypt.hash(password, 12),
        name: name ?? null,
      },
    });
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  }
}

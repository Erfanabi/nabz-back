import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { AppConfigService } from '../../common/config/app-config.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';

export interface StoredFile {
  path: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * استوریج خصوصی فایل‌های حساس (تصویر رسید).
 *
 * فایل‌ها **بیرون از هر مسیر عمومی** می‌نشینند و تنها راه خواندنشان یک URL
 * امضاشدهٔ کوتاه‌عمر است (API-SPEC §۱۰ بند ۱۰). جای‌گذاری این کلاس با S3 بعداً
 * فقط عوض کردن همین سه متد است.
 */
@Injectable()
export class StorageService {
  constructor(
    private readonly config: AppConfigService,
    private readonly clock: ClockService,
  ) {}

  private get root(): string {
    return resolve(this.config.storageDir);
  }

  /** مسیر مطلق را می‌سازد و مطمئن می‌شود از ریشهٔ استوریج بیرون نمی‌زند. */
  private absolute(relativePath: string): string {
    const abs = resolve(join(this.root, normalize(relativePath)));
    if (abs !== this.root && !abs.startsWith(this.root + sep)) {
      throw new AppError('forbidden');
    }
    return abs;
  }

  async save(
    folder: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<StoredFile> {
    const extension = this.extensionFor(mimeType, originalName);
    const relative = join(folder, `${randomUUID()}${extension}`);
    const abs = this.absolute(relative);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buffer, { mode: 0o600 });
    return { path: relative, mimeType, sizeBytes: buffer.byteLength };
  }

  async read(relativePath: string): Promise<Buffer> {
    try {
      return await readFile(this.absolute(relativePath));
    } catch {
      throw new AppError('not_found');
    }
  }

  async remove(relativePath: string): Promise<void> {
    try {
      await unlink(this.absolute(relativePath));
    } catch {
      // فایل نبود — حذف idempotent است.
    }
  }

  /** URL امضاشدهٔ کوتاه‌عمر. امضا روی مسیر و زمان انقضا است. */
  signedUrl(relativePath: string, ttlSeconds = this.config.signedUrlTtlSeconds): string {
    const expires = Math.floor(this.clock.nowMs() / 1000) + ttlSeconds;
    const signature = this.sign(relativePath, expires);
    const query = new URLSearchParams({ path: relativePath, expires: String(expires), sig: signature });
    return `${this.config.publicBaseUrl}/v1/files?${query.toString()}`;
  }

  /** امضا را بررسی می‌کند؛ مقایسه زمان‌ثابت است تا امضا حرف‌به‌حرف حدس زده نشود. */
  verifySignature(relativePath: string, expires: number, signature: string): void {
    if (!Number.isFinite(expires) || expires < Math.floor(this.clock.nowMs() / 1000)) {
      throw new AppError('not_found');
    }
    const expected = this.sign(relativePath, expires);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('not_found');
  }

  private sign(relativePath: string, expires: number): string {
    return createHmac('sha256', this.config.fileUrlSecret)
      .update(`${relativePath}|${expires}`)
      .digest('hex');
  }

  private extensionFor(mimeType: string, originalName: string): string {
    const byMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    if (byMime[mimeType]) return byMime[mimeType];
    const match = originalName.match(/(\.[A-Za-z0-9]{1,5})$/);
    return match ? match[1].toLowerCase() : '';
  }
}

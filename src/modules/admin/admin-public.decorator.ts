import { SetMetadata } from '@nestjs/common';

export const ADMIN_PUBLIC_KEY = 'nabz:admin_public';

/**
 * مسیر ادمینی که توکن ادمین نمی‌خواهد (فقط ورود).
 *
 * عمداً از `@Public()` جدا است: `@Public()` روی کلاس ادمین لازم است تا گارد
 * **کاربر** رد شود، و اگر گارد ادمین هم به همان کلید نگاه می‌کرد، کل پنل بی‌احراز
 * هویت باز می‌شد.
 */
export const AdminPublic = () => SetMetadata(ADMIN_PUBLIC_KEY, true);

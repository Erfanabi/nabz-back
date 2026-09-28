import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'nabz:idempotent';

/**
 * مسیر را idempotent علامت می‌زند (API-SPEC §۲.۶).
 * روی همهٔ POSTهای نوشتنی گذاشته می‌شود، چون کلاینت با شبکهٔ نامطمئن چند بار تلاش می‌کند.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

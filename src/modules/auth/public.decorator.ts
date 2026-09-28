import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'nabz:public';

/** مسیر بدون توکن. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const OPTIONAL_AUTH_KEY = 'nabz:optional_auth';

/** توکن اختیاری — اگر بود خوانده می‌شود، اگر نبود مسیر باز است (مثلاً کاتالوگ پلن‌ها). */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

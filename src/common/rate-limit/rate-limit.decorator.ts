import { SetMetadata } from '@nestjs/common';
import { RateLimitRule } from './rate-limit.service';

export const RATE_LIMIT_KEY = 'nabz:rate_limit';

export interface RateLimitMeta {
  rule: RateLimitRule;
}

/** سقف خاص برای یک مسیر. `null` یعنی گارد عمومی این مسیر را رد کند. */
export const RateLimit = (rule: RateLimitRule | null) =>
  SetMetadata(RATE_LIMIT_KEY, rule === null ? null : { rule });

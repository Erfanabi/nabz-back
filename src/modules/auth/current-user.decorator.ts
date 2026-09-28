import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}

/** کاربر جلسهٔ جاری. همیشه از توکن می‌آید، هیچ‌وقت از بدنه یا مسیر. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthenticatedUser;
  },
);

import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthenticatedAdmin {
  adminId: string;
  role: string;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin =>
    ctx.switchToHttp().getRequest().admin as AuthenticatedAdmin,
);

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export type AiAuthenticatedUser = {
  userId?: string;
  email?: string;
  fullName?: string;
  organizations?: Array<{
    name?: string;
    slug?: string;
    roleName?: string;
    roleCode?: string;
  }>;
  permissions?: string[];
  role?: {
    isSuperAdmin?: boolean;
    permissions?: string[];
    [key: string]: unknown;
  };
};

type JwtPayload = {
  sub?: string;
  email?: string;
  fullName?: string;
  role?: AiAuthenticatedUser['role'];
};

type RequestWithUser = Request & {
  user?: AiAuthenticatedUser;
};

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request);

    if (!token) {
      return true;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      this.logger.warn('AI_CHAT_CONTEXT_SKIPPED:JWT_SECRET_MISSING');
      return true;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });
      request.user = {
        userId: payload.sub,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid token';
      this.logger.warn(`AI_CHAT_CONTEXT_SKIPPED:INVALID_JWT:${message}`);
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return undefined;
    }

    return authorization.slice('Bearer '.length).trim() || undefined;
  }
}

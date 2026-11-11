import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AdminAuthService } from 'src/services/admin-auth.service';

const bearer = (req: Request) => req.headers.authorization?.split(' ')[1];

/// A console session: the admin is put on `req.admin`.
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    req.admin = await this.auth.adminForToken(bearer(req));
    return !!req.admin;
  }
}

/// A sign-in waiting for its code: the admin is put on `req.admin`.
@Injectable()
export class AdminPendingGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    req.admin = await this.auth.adminForToken(bearer(req), true);
    return !!req.admin;
  }
}

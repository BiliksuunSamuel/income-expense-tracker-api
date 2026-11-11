import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRole } from 'src/enums';
import { UserRepository } from 'src/repositories/user.repository';

/// Lets through only admins, by the role on their account (the sign-in token
/// carries none). Goes after JwtAuthGuard.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userRepository: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const id = context.switchToHttp().getRequest()?.user?.id;
    if (!id) return false;
    const user = await this.userRepository.getByIdAsync(id);
    return user?.role === UserRole.Admin || user?.role === UserRole.SuperAdmin;
  }
}

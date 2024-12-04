import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleAuthRequestDto } from 'src/dtos/auth/google.auth.request.dto';
import { UserStatus } from 'src/enums';
import { User } from 'src/schemas/user.schema.dto';
import { generateId } from 'src/utils';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);
  constructor(
    @InjectModel(User.name) private readonly userRepository: Model<User>,
  ) {}

  async getByEmailAsync(email: string): Promise<User> {
    return await this.userRepository.findOne({ email }).lean();
  }

  async updateAsync(email: string, user: User): Promise<User> {
    const doc = await this.userRepository
      .findOneAndUpdate(
        { email },
        { ...user, updatedAt: new Date() },
        { new: true },
      )
      .lean();
    return doc;
  }

  async addAsync(user: User): Promise<User> {
    const res = await this.userRepository.create({
      ...user,
      createdAt: new Date(),
      id: generateId(),
    });
    const data = await this.getByIdAsync(res.id);
    return data;
  }

  //get user by id
  async getByIdAsync(id: string): Promise<User> {
    return await this.userRepository.findOne({ id }).lean();
  }

  //hanndle google auth
  async handleGoogleAuthAsync(request: GoogleAuthRequestDto): Promise<User> {
    this.logger.debug('Handling google auth', request);
    const userByEmail = await this.userRepository
      .findOne({ email: request.email })
      .lean();
    if (userByEmail) {
      const doc = await this.userRepository
        .findOneAndUpdate(
          { email: request.email },
          {
            $set: {
              picture: request.picture,
              googleAccessToken: request.accessToken,
              firstName: request.firstName,
              lastName: request.lastName,
              updatedAt: new Date(),
              isGoogleAuth: true,
              isLoggedIn: true,
              updatedBy: request.email,
              tokenId: generateId(),
              emailVerified: request.emailVerified,
              authenticated: true,
              resetPassword: false,
            },
          },
          { new: true },
        )
        .lean();
      return doc;
    }
    const res = await this.userRepository.create({
      ...request,
      isGoogleAuth: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoggedIn: true,
      updatedBy: request.email,
      googleAccessToken: request.accessToken,
      id: generateId(),
      status: UserStatus.Active,
      tokenId: generateId(),
    });
    const data = await this.getByIdAsync(res.id);
    return data;
  }
}
